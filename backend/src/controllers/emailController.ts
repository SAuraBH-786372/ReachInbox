import { Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../services/prisma';
import { emailQueue, EmailJobData } from '../queues/emailQueue';
import { searchEmailsInES } from '../services/elasticsearch';

const scheduleSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
  subject: z.string().min(1, 'subject is required'),
  body: z.string().min(1, 'body is required'),
  recipients: z.array(z.string().email('Invalid recipient email')).min(1, 'At least one recipient is required'),
  scheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduledAt must be a valid ISO date string',
  }),
  minDelaySeconds: z.number().optional().default(2),
  maxEmailsPerHour: z.number().optional().default(100),
});

export async function scheduleEmails(req: Request, res: Response) {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      });
    }

    const { senderId, subject, body, recipients, scheduledAt, minDelaySeconds, maxEmailsPerHour } = parsed.data;

    // Verify sender exists
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      include: { user: true },
    });

    if (!sender) {
      return res.status(404).json({
        success: false,
        error: `Sender with id "${senderId}" not found`,
      });
    }

    const batchId = randomUUID();
    const scheduledDate = new Date(scheduledAt);
    const delay = Math.max(0, scheduledDate.getTime() - Date.now());

    const scheduledJobs: { id: string; recipientEmail: string; scheduledAt: Date }[] = [];

    // Process recipients sequentially (not wrapped in a DB transaction around BullMQ)
    for (const recipient of recipients) {
      // 1. Insert EmailJob record with bullJobId = null initially
      const emailJob = await prisma.emailJob.create({
        data: {
          userId: sender.userId,
          senderId: sender.id,
          recipientEmail: recipient,
          subject,
          body,
          status: 'scheduled',
          scheduledAt: scheduledDate,
          batchId,
          bullJobId: null,
        },
      });

      const deterministicJobId = `email-job-${emailJob.id}`;

      // Check if job already has a live BullMQ job in Redis (idempotency safeguard)
      let alreadyQueued = false;
      try {
        const existingLiveJob = await emailQueue.getJob(deterministicJobId);
        if (existingLiveJob) {
          const state = await existingLiveJob.getState();
          if (state === 'waiting' || state === 'delayed' || state === 'active') {
            alreadyQueued = true;
          }
        }
      } catch (err: any) {
        console.warn(`[Schedule] Error checking live job for ${deterministicJobId}:`, err.message);
      }

      let bullJobId = deterministicJobId;
      if (!alreadyQueued) {
        const jobData: EmailJobData = {
          emailJobId: emailJob.id,
          senderId: sender.id,
          userId: sender.userId,
          recipientEmail: recipient,
          subject,
          body,
          maxEmailsPerHour,
          minDelaySeconds,
        };

        const queuedJob = await emailQueue.add('send-email', jobData, {
          jobId: deterministicJobId,
          delay,
        });

        bullJobId = queuedJob.id || deterministicJobId;
      }

      // 2. Immediately update DB row with the BullMQ job ID
      await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId },
      });

      scheduledJobs.push({
        id: emailJob.id,
        recipientEmail: emailJob.recipientEmail,
        scheduledAt: emailJob.scheduledAt,
      });
    }

    return res.status(201).json({
      batchId,
      scheduledCount: scheduledJobs.length,
      jobs: scheduledJobs,
    });
  } catch (error: any) {
    console.error('Schedule error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
  }
}

export async function getScheduledEmails(req: Request, res: Response) {
  try {
    const { page = '1', limit = '20', search = '', status } = req.query;
    const userId = (req.user as any)?.id;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    const where: any = {
      ...(userId ? { userId } : {}),
      ...(status
        ? { status: String(status) }
        : { status: { in: ['scheduled', 'processing'] } }),
      ...(search
        ? {
            OR: [
              { recipientEmail: { contains: String(search), mode: 'insensitive' } },
              { subject: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { scheduledAt: 'asc' },
        include: { sender: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({ data: jobs, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('[GetScheduled] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSentEmails(req: Request, res: Response) {
  try {
    const { page = '1', limit = '20', search = '', status } = req.query;
    const userId = (req.user as any)?.id;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    const where: any = {
      ...(userId ? { userId } : {}),
      ...(status
        ? { status: String(status) }
        : { status: { in: ['sent', 'failed'] } }),
      ...(search
        ? {
            OR: [
              { recipientEmail: { contains: String(search), mode: 'insensitive' } },
              { subject: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { sentAt: 'desc' },
        include: { sender: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({ data: jobs, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('[GetSent] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteEmailJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    const job = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    if (userId && job.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status === 'scheduled' && job.bullJobId) {
      try {
        if (typeof (emailQueue as any).remove === 'function') {
          await (emailQueue as any).remove(job.bullJobId);
        } else {
          const liveJob = await emailQueue.getJob(job.bullJobId);
          if (liveJob) {
            await liveJob.remove();
          }
        }
      } catch (err: any) {
        console.warn(`[Delete] Failed to remove BullMQ job ${job.bullJobId}:`, err.message);
      }
    }

    await prisma.emailJob.delete({
      where: { id },
    });

    return res.status(200).json({ success: true, message: 'Email job deleted' });
  } catch (error: any) {
    console.error('[DeleteEmailJob] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function archiveEmailJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    const job = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    if (userId && job.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (job.status === 'scheduled' && job.bullJobId) {
      try {
        if (typeof (emailQueue as any).remove === 'function') {
          await (emailQueue as any).remove(job.bullJobId);
        } else {
          const liveJob = await emailQueue.getJob(job.bullJobId);
          if (liveJob) {
            await liveJob.remove();
          }
        }
      } catch (err: any) {
        console.warn(`[Archive] Failed to remove BullMQ job ${job.bullJobId}:`, err.message);
      }
    }

    const updatedJob = await prisma.emailJob.update({
      where: { id },
      data: { status: 'archived' },
    });

    return res.status(200).json({ success: true, data: updatedJob });
  } catch (error: any) {
    console.error('[ArchiveEmailJob] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function unarchiveEmailJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req.user as any)?.id;

    const job = await prisma.emailJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Email job not found' });
    }

    if (userId && job.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Determine target status: if it has sentAt set, restore to 'sent', else 'scheduled'
    const targetStatus = job.sentAt ? 'sent' : 'scheduled';

    const updatedJob = await prisma.emailJob.update({
      where: { id },
      data: { status: targetStatus },
    });

    return res.status(200).json({ success: true, data: updatedJob });
  } catch (error: any) {
    console.error('[UnarchiveEmailJob] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getArchivedEmails(req: Request, res: Response) {
  try {
    const { page = '1', limit = '20', search = '' } = req.query;
    const userId = (req.user as any)?.id;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

    const where: any = {
      ...(userId ? { userId } : {}),
      status: 'archived',
      ...(search
        ? {
            OR: [
              { recipientEmail: { contains: String(search), mode: 'insensitive' } },
              { subject: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: { sender: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({ data: jobs, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('[GetArchived] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function searchEmails(req: Request, res: Response) {
  try {
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Step 1: Query Elasticsearch for matching IDs
    const { ids, total } = await searchEmailsInES({
      q,
      status,
      from,
      to,
      page,
      limit,
    });

    if (ids.length === 0) {
      return res.json({ data: [], total: 0, page, limit });
    }

    // Step 2: Fetch full entity rows from PostgreSQL (source of truth)
    const rows = await prisma.emailJob.findMany({
      where: { id: { in: ids } },
      include: { sender: true, user: true },
    });

    // Re-order by ES relevance
    const idOrderMap = new Map(ids.map((id, idx) => [id, idx]));
    rows.sort((a, b) => (idOrderMap.get(a.id) ?? 0) - (idOrderMap.get(b.id) ?? 0));

    return res.json({ data: rows, total, page, limit });
  } catch (error: any) {
    console.error('[SearchEmails] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
