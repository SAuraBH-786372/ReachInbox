import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { prisma } from '../services/prisma';
import nodemailer from 'nodemailer';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  try {
    let senders = await prisma.sender.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (senders.length === 0) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        const newSender = await prisma.sender.create({
          data: {
            userId: user.id,
            email: testAccount.user,
            smtpConfigJson: {
              host: 'smtp.ethereal.email',
              port: 587,
              secure: false,
              user: testAccount.user,
              pass: testAccount.pass,
              fromName: user.name || 'Test User',
            },
          },
        });
        senders = [newSender];
      } catch (err: any) {
        console.warn('[Senders] Could not auto-provision ethereal sender:', err?.message);
      }
    }

    res.json(senders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

router.post('/create-ethereal', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  try {
    const testAccount = await nodemailer.createTestAccount();
    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        email: testAccount.user,
        smtpConfigJson: {
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          user: testAccount.user,
          pass: testAccount.pass,
          fromName: user.name || 'Test User',
        },
      },
    });
    res.json(sender);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ethereal sender' });
  }
});

export default router;
