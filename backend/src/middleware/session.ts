import session from 'express-session';
import MemoryStore from 'memorystore';
import { config } from '../config';

const MemStore = MemoryStore(session);

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || config.sessionSecret || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: new MemStore({ checkPeriod: 86400000 }),
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});

