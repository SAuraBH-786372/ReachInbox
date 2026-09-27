import session from 'express-session';
import MemoryStore from 'memorystore';
import { config } from '../config';

const MemStore = MemoryStore(session);

const isProduction = process.env.NODE_ENV === 'production';

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || config.sessionSecret || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  proxy: isProduction, // trust Render's TLS-terminating reverse proxy
  store: new MemStore({ checkPeriod: 86400000 }),
  cookie: {
    httpOnly: true,
    secure: isProduction,           // HTTPS-only in production
    sameSite: isProduction ? 'none' : 'lax', // cross-origin in prod
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});

