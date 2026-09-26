import { prisma } from '../services/prisma';
import { emailQueue, EmailJobData } from '../queues/emailQueue';

export async function recoverJobs(): Promise<{ recoveredCount: number; skippedCount: number }> {
  console.log('[CrashRecovery] ─────────────────────────────');
  console.log('[CrashRecovery] Starting recovery scan...');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Find all scheduled or interrupted jobs within window
  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: {
        in: ['scheduled', 'processing'],
      },
      scheduledAt: {
        gte: oneHourAgo,
      },
    },
    include: {
      sender: {
        include: {
          rateLimitConfigs: true,
        },
      },
    },
  });

  console.log(`[CrashRecovery] Found ${pendingJobs.length} jobs to check`);

  let recovered = 0;
  let skipped = 0;

  for (const job of pendingJobs) {
    const bullJobIdentifier = job.bullJobId || `email-job-${job.id}`;
    console.log(`[CrashRecovery] Checking: ${bullJobIdentifier}`);

    // If status was "processing" (crashed mid-send):
    let wasProcessing = false;
    if (job.status === 'processing') {
      wasProcessing = true;
      console.log(`[CrashRecovery] ⚠ Was processing — reset to scheduled`);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'scheduled' },
      });
    }

    let isLiveInRedis = false;

    if (job.bullJobId) {
      try {
        const liveJob = await emailQueue.getJob(job.bullJobId);
        if (liveJob) {
          const state = await liveJob.getState();
          if (state === 'waiting' || state === 'delayed' || state === 'active') {
            isLiveInRedis = true;
          }
        }
      } catch (err: any) {
        console.warn(`[CrashRecovery] Could not verify Redis job ${job.bullJobId}:`, err.message);
      }
    }

    if (isLiveInRedis && !wasProcessing) {
      console.log(`[CrashRecovery] ✓ Alive in Redis — skipping`);
      skipped++;
      continue;
    }

    console.log(`[CrashRecovery] ✗ Missing from Redis — re-enqueuing`);

    // Determine rate limit config
    const rateLimitConfig = job.sender?.rateLimitConfigs?.[0];
    const maxEmailsPerHour = rateLimitConfig?.maxEmailsPerHour || 100;
    const minDelaySeconds = rateLimitConfig?.minDelaySeconds || 2;

    const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());

    const jobData: EmailJobData = {
      emailJobId: job.id,
      senderId: job.senderId,
      userId: job.userId,
      recipientEmail: job.recipientEmail,
      subject: job.subject,
      body: job.body,
      maxEmailsPerHour,
      minDelaySeconds,
    };

    await emailQueue.add('send-email', jobData, {
      jobId: bullJobIdentifier,
      delay,
    });

    if (wasProcessing) {
      console.log(`[CrashRecovery] ✓ Re-enqueued immediately`);
    } else {
      console.log(`[CrashRecovery] ✓ Re-enqueued with delay: ${delay}ms`);
    }

    if (job.bullJobId !== bullJobIdentifier) {
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJobIdentifier },
      });
    }

    recovered++;
  }

  console.log(`[CrashRecovery] ─────────────────────────────`);
  console.log(`[CrashRecovery] Complete:`);
  console.log(`[CrashRecovery]   ${recovered} jobs recovered`);
  console.log(`[CrashRecovery]   ${skipped} jobs already alive`);
  console.log(`[CrashRecovery] ─────────────────────────────`);

  return { recoveredCount: recovered, skippedCount: skipped };
}
