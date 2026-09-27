import { Queue } from 'bullmq';
import { createRedisConnection } from '../services/redis';

export interface EmailJobData {
  emailJobId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  maxEmailsPerHour: number;
  minDelaySeconds: number;
}

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // keep completed jobs for 24h for audit/idempotency check
      count: 5000,
    },
    removeOnFail: {
      age: 604800, // keep failed jobs for 7 days
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('[BullMQ Queue] Error:', err.message);
});
