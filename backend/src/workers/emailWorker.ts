import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queues/emailQueue';
import { createRedisConnection } from '../services/redis';
import { prisma } from '../services/prisma';
import { checkAndIncrementRateLimit, decrementRateLimit } from '../services/rateLimiter';
import { notifyRateLimitHit } from '../services/slack';
import { indexEmailJob } from '../services/elasticsearch';
import { config } from '../config';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>, token?: string) => {
      const { emailJobId, senderId, userId, recipientEmail, subject, body, maxEmailsPerHour } = job.data;

      // ── Step 1: Idempotency Guard ──────────────────────────────────────
      const emailJob = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
      });

      if (!emailJob) {
        console.warn(`[EmailWorker] EmailJob ${emailJobId} not found in database. Skipping.`);
        return;
      }

      if (emailJob.status === 'sent' || emailJob.status === 'failed') {
        console.log(`[EmailWorker] EmailJob ${emailJobId} already finalized with status "${emailJob.status}". Skipping.`);
        return;
      }

      // Mark as processing
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'processing' },
      });

      // ── Step 2: Per-Sender Hourly Rate Limit ───────────────────────────
      const limitResult = await checkAndIncrementRateLimit(senderId, maxEmailsPerHour);

      if (!limitResult.allowed) {
        console.log(
          `[EmailWorker] Rate limit reached for sender ${senderId}. Moving job ${job.id} to next UTC hour window: ${limitResult.nextHourStart.toISOString()}`
        );

        // Reset database record status to scheduled
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: 'scheduled' },
        });

        // Fetch sender email for Slack alert
        const sender = await prisma.sender.findUnique({
          where: { id: senderId },
        });

        // Trigger Slack notification asynchronously
        notifyRateLimitHit(userId, senderId, {
          sender: sender?.email || senderId,
          hour: limitResult.hourString,
          limit: maxEmailsPerHour,
          nextSlotAt: limitResult.nextHourStart,
        }).catch((err) => console.error('[EmailWorker] Slack notification error:', err.message));

        // Delay the job in BullMQ to the start of the next hour
        if (token) {
          await job.moveToDelayed(limitResult.nextHourStart.getTime(), token);
        } else {
          await job.moveToDelayed(limitResult.nextHourStart.getTime());
        }

        // Return without sending
        return;
      }

      // ── Step 3: Send Email ─────────────────────────────────────────────
      const sender = await prisma.sender.findUnique({
        where: { id: senderId },
      });

      if (!sender) {
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: 'failed' },
        });
        await decrementRateLimit(senderId);
        throw new Error(`Sender ${senderId} not found in database.`);
      }

      const smtpConfig = sender.smtpConfigJson as any;

      try {
        let messageId: string;

        if (config.sendgrid.apiKey) {
          // ── Strategy A: SendGrid HTTP API (works on Render, sends REAL emails) ──
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(config.sendgrid.apiKey);

          const fromEmail = config.sendgrid.fromEmail || sender.email;
          const fromName = config.sendgrid.fromName || smtpConfig.fromName || 'ReachInbox';

          const msg = {
            to: recipientEmail,
            from: { email: fromEmail, name: fromName },
            subject,
            html: body,
          };

          const [response] = await sgMail.send(msg);
          messageId = response.headers['x-message-id'] || `sg-${Date.now()}`;
          console.log(`[EmailWorker] ✅ REAL email sent via SendGrid to ${recipientEmail}. MessageId: ${messageId}`);

        } else if (smtpConfig.host === 'smtp.ethereal.email') {
          // ── Strategy B: Mock Ethereal (Render blocks SMTP ports) ──
          await new Promise(r => setTimeout(r, 1000));
          messageId = `<mock-${Date.now()}@ethereal.email>`;
          console.log(`[EmailWorker] (Mocked for Render) Email sent to ${recipientEmail}`);

        } else {
          // ── Strategy C: Real SMTP (for non-Ethereal providers) ──
          const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure ?? false,
            auth: {
              user: smtpConfig.user,
              pass: smtpConfig.pass,
            },
          });

          const info = await transporter.sendMail({
            from: `"${smtpConfig.fromName || 'ReachInbox Sender'}" <${sender.email}>`,
            to: recipientEmail,
            subject,
            html: body,
          });

          messageId = info.messageId;
          const previewUrl = nodemailer.getTestMessageUrl(info);
          if (previewUrl) {
            console.log(`[EmailWorker] Ethereal Preview URL: ${previewUrl}`);
          }
        }

        const sentAt = new Date();

        // Update DB status to sent
        const updatedJob = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'sent',
            sentAt,
          },
        });

        console.log(`[EmailWorker] Email sent successfully to ${recipientEmail}. MessageId: ${messageId}`);

        // ── Step 4: Index in Elasticsearch ───────────────────────────────
        await indexEmailJob({
          id: updatedJob.id,
          recipientEmail: updatedJob.recipientEmail,
          subject: updatedJob.subject,
          body: updatedJob.body,
          status: updatedJob.status,
          scheduledAt: updatedJob.scheduledAt,
          sentAt: updatedJob.sentAt,
          senderId: updatedJob.senderId,
          userId: updatedJob.userId,
        });
      } catch (sendError: any) {
        console.error(`[EmailWorker] Failed to send email for job ${emailJobId}:`, sendError.message);

        // Decrement counter so the hourly slot is not wasted
        await decrementRateLimit(senderId);

        // Update database record as failed
        const failedJob = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: 'failed' },
        });

        // Index failed status in Elasticsearch
        await indexEmailJob({
          id: failedJob.id,
          recipientEmail: failedJob.recipientEmail,
          subject: failedJob.subject,
          body: failedJob.body,
          status: failedJob.status,
          scheduledAt: failedJob.scheduledAt,
          sentAt: null,
          senderId: failedJob.senderId,
          userId: failedJob.userId,
        });

        // Rethrow so BullMQ logs and triggers retries
        throw sendError;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: config.workerConcurrency,
      limiter: {
        max: 1,
        duration: config.minDelaySeconds * 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[EmailWorker] Job ${job?.id} failed with error:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed successfully.`);
  });

  return worker;
}
