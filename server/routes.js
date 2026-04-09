import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  createUser,
  findUserByEmail,
  findUserByCredentialID,
  findUserById,
  updateUser,
} from './usersStore.js';

const router = express.Router();

function rpConfig(req) {
  const originHeader = req.get('origin');
  const host = req.get('host') || '';
  let hostname = host.split(':')[0] || 'localhost';
  if (originHeader) {
    try {
      hostname = new URL(originHeader).hostname;
    } catch {
      /* keep host-derived hostname */
    }
  }
  const rpID = process.env.WEBAUTHN_RP_ID || hostname;
  const origin =
    process.env.WEBAUTHN_ORIGIN ||
    originHeader ||
    `${req.protocol}://${host}`;
  return { rpID, origin };
}

function requireSessionUser(req, res, next) {
  const uid = req.session?.userId;
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = findUserById(uid);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  createUser({
    id,
    email: String(email).toLowerCase(),
    passwordHash,
    webauthnCredentials: [],
  });
  req.session.userId = id;
  res.json({ ok: true, user: { id, email: String(email).toLowerCase() } });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  res.json({
    ok: true,
    user: { id: user.id, email: user.email, webauthnEnabled: (user.webauthnCredentials?.length || 0) > 0 },
  });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/auth/me', (req, res) => {
  const uid = req.session?.userId;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const user = findUserById(uid);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      webauthnEnabled: (user.webauthnCredentials?.length || 0) > 0,
    },
  });
});

router.post('/webauthn/register/options', requireSessionUser, async (req, res) => {
  try {
    const { rpID, origin } = rpConfig(req);
    const user = req.user;
    const userID = Buffer.from(user.id.replace(/-/g, ''), 'hex');
    const excludeCredentials = (user.webauthnCredentials || []).map((c) => ({
      id: Buffer.from(c.credentialID, 'base64url'),
      type: 'public-key',
      transports: c.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName: 'WebAuthn Demo',
      rpID,
      userID,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    req.session.webauthnChallenge = options.challenge;
    req.session.webauthnRpID = rpID;
    req.session.webauthnOrigin = origin;

    res.json(options);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to start registration' });
  }
});

router.post('/webauthn/register/verify', requireSessionUser, async (req, res) => {
  try {
    const { rpID, origin } = rpConfig(req);
    const expectedChallenge = req.session.webauthnChallenge;
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No active registration challenge' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const credentialID = credential.id;
    const credentialPublicKey = Buffer.from(credential.publicKey).toString('base64url');

    updateUser(req.user.id, (u) => {
      const list = u.webauthnCredentials || [];
      const next = list.filter((c) => c.credentialID !== credentialID);
      next.push({
        credentialID,
        credentialPublicKey,
        counter: credential.counter,
        transports: credential.transports,
      });
      return { ...u, webauthnCredentials: next };
    });

    delete req.session.webauthnChallenge;
    delete req.session.webauthnRpID;
    delete req.session.webauthnOrigin;

    res.json({ ok: true, webauthnEnabled: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Verification failed' });
  }
});

router.post('/webauthn/disable', requireSessionUser, (req, res) => {
  try {
    updateUser(req.user.id, (u) => ({ ...u, webauthnCredentials: [] }));
    res.json({ ok: true, webauthnEnabled: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to disable passkey' });
  }
});

router.post('/webauthn/login/options', async (req, res) => {
  try {
    const { rpID, origin } = rpConfig(req);
    const { email } = req.body || {};
    const normalizedEmail = email ? String(email).toLowerCase().trim() : '';

    // If email is provided we can narrow to that user's allowCredentials.
    // If not, we allow username-less sign-in (discoverable credentials / resident keys).
    const user = normalizedEmail ? findUserByEmail(normalizedEmail) : undefined;
    const userHasCreds = user && (user.webauthnCredentials || []).length > 0;
    if (normalizedEmail && !userHasCreds) {
      return res.status(400).json({
        error:
          'No passkey for this account. Sign in with password and enable fingerprint first.',
      });
    }

    const allowCredentials = userHasCreds
      ? user.webauthnCredentials.map((c) => ({
          id: Buffer.from(c.credentialID, 'base64url'),
          type: 'public-key',
          transports: c.transports,
        }))
      : undefined;

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    req.session.webauthnAuthChallenge = options.challenge;
    req.session.webauthnAuthUserId = userHasCreds ? user.id : null;
    req.session.webauthnRpID = rpID;
    req.session.webauthnOrigin = origin;

    res.json(options);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

router.post('/webauthn/login/verify', async (req, res) => {
  try {
    const expectedChallenge = req.session.webauthnAuthChallenge;
    const userId = req.session.webauthnAuthUserId;
    const { rpID, origin } = rpConfig(req);

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'No active sign-in challenge' });
    }

    const body = req.body;
    const credIdB64 = body?.id;
    if (!credIdB64) {
      return res.status(400).json({ error: 'Invalid credential' });
    }

    // If userId is known (email-based options) use it, otherwise discover user by credentialID.
    const user = userId ? findUserById(userId) : findUserByCredentialID(credIdB64);
    if (!user) {
      return res.status(400).json({ error: 'User not found for this credential' });
    }

    const authenticator = user.webauthnCredentials.find(
      (c) => c.credentialID === credIdB64
    );
    if (!authenticator) {
      return res.status(400).json({ error: 'Unknown credential' });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credentialID,
        publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
        counter: authenticator.counter,
        transports: authenticator.transports,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    updateUser(user.id, (u) => {
      const list = (u.webauthnCredentials || []).map((c) =>
        c.credentialID === authenticator.credentialID
          ? { ...c, counter: verification.authenticationInfo.newCounter }
          : c
      );
      return { ...u, webauthnCredentials: list };
    });

    delete req.session.webauthnAuthChallenge;
    delete req.session.webauthnAuthUserId;

    req.session.userId = user.id;

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        webauthnEnabled: true,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'Verification failed' });
  }
});

export default router;
export { requireSessionUser };
