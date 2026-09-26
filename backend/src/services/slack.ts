import { prisma } from './prisma';
import axios from 'axios';

export interface RateLimitNotificationDetails {
  sender: string;
  hour: string;
  limit: number;
  nextSlotAt: Date;
}

export async function notifyRateLimitHit(
  userId: string,
  senderId: string,
  details: RateLimitNotificationDetails
): Promise<void> {
  try {
    const slackIntegration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!slackIntegration || !slackIntegration.webhookUrl) {
      return;
    }

    const payload = {
      text: `⚠️ Rate limit reached for sender ${details.sender}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Sender Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${details.sender}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${details.limit} emails / hr`,
            },
            {
              type: 'mrkdwn',
              text: `*UTC Window:*\n\`${details.hour}:00:00\``,
            },
            {
              type: 'mrkdwn',
              text: `*Next Available Slot:*\n<!date^${Math.floor(details.nextSlotAt.getTime() / 1000)}^{date_num} {time_secs}|${details.nextSlotAt.toISOString()}>`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Scheduler automatically deferred pending emails to the next hour window.`,
            },
          ],
        },
      ],
    };

    await axios.post(slackIntegration.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[Slack] Failed to deliver rate limit notification for user ${userId}:`, error.message);
  }
}

