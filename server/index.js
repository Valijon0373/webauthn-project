import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import routes from './routes.js';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const app = express();

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev-only-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SESSION_COOKIE_SECURE === 'true' || (isProd && process.env.SESSION_COOKIE_SECURE !== 'false'),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
