import { Router, Request, Response } from 'express';
import passport from 'passport';
import nodemailer from 'nodemailer';
import { config } from '../config';
import { prisma } from '../services/prisma';

const router = Router();

router.get('/dev-login', async (req: Request, res: Response) => {
  try {
    // Upsert demo user
    let user = await prisma.user.findUnique({ where: { email: 'demo@reachinbox.ai' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@reachinbox.ai',
          name: 'ReachInbox Demo',
          googleId: 'dev-google-id',
        },
      });
    }

    // Upsert a demo sender with working Ethereal SMTP so all features work out of the box
    // Dynamically generate real Ethereal credentials so SMTP auth doesn't fail
    let etherealUser = config.ethereal.user;
    let etherealPass = config.ethereal.pass;
    
    if (!etherealUser || !etherealPass) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        etherealUser = testAccount.user;
        etherealPass = testAccount.pass;
      } catch (err) {
        console.error('[Auth] Failed to generate Ethereal test account:', err);
        // Fallback placeholders (these will fail to send, but prevent crash)
        etherealUser = 'demo@ethereal.email';
        etherealPass = 'demopass';
      }
    }

    const demoSenderEmail = 'demo@reachinbox.ai';
    const existingSender = await prisma.sender.findFirst({ where: { userId: user.id, email: demoSenderEmail } });

    if (existingSender) {
      await prisma.sender.update({
        where: { id: existingSender.id },
        data: {
          smtpConfigJson: {
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            user: etherealUser,
            pass: etherealPass,
            fromName: 'ReachInbox Demo',
          },
        }
      });
    } else {
      await prisma.sender.create({
        data: {
          userId: user.id,
          email: demoSenderEmail,
          smtpConfigJson: {
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            user: etherealUser,
            pass: etherealPass,
            fromName: 'ReachInbox Demo',
          },
        },
      });
    }

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      req.session.save(() => {
        // Return JSON so the frontend can redirect — a server-side redirect
        // across domains loses the session cookie
        res.json({ success: true, redirectTo: `${config.corsOrigin}/dashboard` });
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
