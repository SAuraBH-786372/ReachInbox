import { Router, Request, Response } from 'express';
import passport from 'passport';
import { config } from '../config';
import { prisma } from '../services/prisma';

const router = Router();

router.get('/dev-login', async (req: Request, res: Response) => {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@reachinbox.ai',
          name: 'ReachInbox Demo',
          googleId: 'dev-google-id',
        },
      });
    }
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      req.session.save(() => {
        res.redirect(`${config.corsOrigin}/dashboard`);
      });
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Dev login failed' });
  }
});

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${config.corsOrigin}/login` }),
  (req, res) => {
    req.session.save(() => {
      res.redirect(`${config.corsOrigin}/dashboard`);
    });
  }
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const user = req.user as any;
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    req.session.destroy((err2) => {
      if (err2) {
         return res.status(500).json({ error: 'Failed to destroy session' });
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ success: true });
    });
  });
});

export default router;
