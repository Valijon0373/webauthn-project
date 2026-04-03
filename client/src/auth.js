const jsonHeaders = { 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...jsonHeaders, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function register(email, password) {
  return api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email, password) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return api('/auth/logout', { method: 'POST' });
}

export function me() {
  return api('/auth/me');
}

export function webauthnRegisterOptions() {
  return api('/webauthn/register/options', { method: 'POST' });
}

export function webauthnRegisterVerify(body) {
  return api('/webauthn/register/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function webauthnLoginOptions(email) {
  return api('/webauthn/login/options', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function webauthnLoginVerify(body) {
  return api('/webauthn/login/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
