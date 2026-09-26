import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';
import { prisma } from '../services/prisma';

const router = Router();

function signState(userId: string): string {
  const hmac = crypto.createHmac('sha256', config.sessionSecret);
  hmac.update(userId);
  return `${userId}.${hmac.digest('hex')}`;
}

function verifyState(state: string): string | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [userId, hash] = parts;
  const expectedHash = crypto.createHmac('sha256', config.sessionSecret).update(userId).digest('hex');
  if (hash !== expectedHash) return null;
  return userId;
}

router.get('/oauth/start', requireAuth, (req: Request, res: Response) => {
  const user = req.user as any;
  const state = signState(user.id);
  const slackClientId = process.env.SLACK_CLIENT_ID || '';
  const redirectUri = process.env.SLACK_REDIRECT_URI || '';
  
  const slackUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=incoming-webhook&redirect_uri=${redirectUri}&state=${state}`;
  res.redirect(slackUrl);
});

router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${config.corsOrigin}/dashboard?slack=error`);
  }

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).send('Invalid request');
  }

  const userId = verifyState(state);
  if (!userId) {
    return res.status(403).send('Invalid state parameter (CSRF protection failed)');
  }

  try {
    const slackClientId = process.env.SLACK_CLIENT_ID || '';
    const slackClientSecret = process.env.SLACK_CLIENT_SECRET || '';
    const redirectUri = process.env.SLACK_REDIRECT_URI || '';

    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: slackClientId,
        client_secret: slackClientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;
    if (!data.ok) {
      console.error('[Slack] OAuth exchange failed:', data.error);
      return res.redirect(`${config.corsOrigin}/dashboard?slack=error`);
    }

    const { access_token, incoming_webhook, team } = data;

    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        accessToken: access_token,
        webhookUrl: incoming_webhook.url,
        channel: incoming_webhook.channel,
        teamId: team.id,
      },
      create: {
        userId,
        accessToken: access_token,
        webhookUrl: incoming_webhook.url,
        channel: incoming_webhook.channel,
        teamId: team.id,
      },
    });

    res.redirect(`${config.corsOrigin}/dashboard/settings?slack=connected`);
  } catch (err: any) {
    console.error('[Slack] OAuth callback error:', err.message);
    res.redirect(`${config.corsOrigin}/dashboard?slack=error`);
  }
});

router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: user.id },
    });

    if (integration) {
      res.json({
        connected: true,
        channel: integration.channel || null,
        teamName: integration.teamId || null, 
      });
    } else {
      res.json({ connected: false, channel: null, teamName: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Slack status' });
  }
});

router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  try {
    await prisma.slackIntegration.delete({
      where: { userId: user.id },
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
       return res.status(200).json({ success: true }); // already deleted
    }
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
