# ReachInbox Email Job Scheduler

> Full-stack email scheduling system built with Express.js,
> BullMQ, Redis, PostgreSQL, Elasticsearch, and Next.js.

## Features Implemented

### Backend
- ✅ Email scheduling via POST /api/emails/schedule
- ✅ BullMQ delayed jobs (NO cron — pure queue-based scheduling)
- ✅ PostgreSQL persistence via Prisma ORM
- ✅ Crash recovery on restart (recoverJobs.ts)
- ✅ Idempotency (bullJobId stored in DB, no double-sends)
- ✅ Per-sender hourly rate limiting (Redis Lua script)
- ✅ Minimum delay between sends (BullMQ queue limiter, 2s)
- ✅ Configurable worker concurrency (WORKER_CONCURRENCY env)
- ✅ Ethereal Email fake SMTP sending
- ✅ Elasticsearch indexing for email search
- ✅ BullMQ live dashboard at /admin/queues
- ✅ Google OAuth 2.0 login
- ✅ Slack OAuth integration + rate limit notifications
- ✅ Multi-sender support

### Frontend
- ✅ Google OAuth login page
- ✅ Protected dashboard (redirects to login if unauthenticated)
- ✅ Sidebar navigation with live email counts
- ✅ Scheduled emails list with status badges and scheduled time
- ✅ Sent emails list with sent timestamps
- ✅ Email detail panel with star, archive, delete actions
- ✅ Compose full-screen view with rich text editor
- ✅ CSV/paste recipient upload with live email count
- ✅ Search bar with debounce (filters by email/subject)
- ✅ Filter by status dropdown
- ✅ Manual refresh button with last-updated indicator
- ✅ Auto-refresh every 10 seconds on scheduled tab
- ✅ Slack integration settings page
- ✅ Toast notifications for all actions

## Architecture Overview

### How Scheduling Works

```text
User submits compose form
↓
POST /api/emails/schedule
↓
For each recipient:
  INSERT EmailJob row in PostgreSQL (status: "scheduled")
  Enqueue BullMQ delayed job with jobId = "email-job-{dbId}"
  delay = scheduledAt - now()
  UPDATE EmailJob.bullJobId = returned BullMQ job id
↓
BullMQ holds job in Redis until scheduledAt
↓
Worker picks up job at scheduled time:
  Idempotency check (skip if already "sent")
  Rate limit check (Redis Lua script, per sender per hour)
  If rate limited: moveToDelayed(nextHourStart), notify Slack
  If ok: send via Ethereal SMTP
  UPDATE EmailJob status = "sent", sentAt = now()
  Index document in Elasticsearch
```

### How Persistence on Restart Works

PostgreSQL is the single source of truth. Redis (BullMQ)
is a cache of what needs to run.

On every server start, recoverJobs.ts runs:
1. Query all EmailJob rows with status "scheduled" or "processing"
2. For each row, check if a live BullMQ job exists in Redis
   using queue.getJob(bullJobId)
3. If job EXISTS in Redis → skip (already scheduled, do nothing)
4. If job MISSING from Redis (Redis was wiped/restarted):
   - Re-enqueue with remaining delay = scheduledAt - now()
   - If scheduledAt is in the past: enqueue immediately
5. If status is "processing" (crashed mid-send):
   - Reset to "scheduled" and re-enqueue

Result: Future emails always send at the correct time after
any restart. Emails are never duplicated or lost.

### How Rate Limiting Works

Two layers of rate limiting:

Layer 1 — Minimum delay between sends (provider throttling):
  BullMQ queue limiter: { max: 1, duration: MIN_DELAY_SECONDS * 1000 }
  Enforces a global minimum gap between any two email sends.
  Default: 2 seconds. Configurable via MIN_DELAY_SECONDS env var.

Layer 2 — Hourly cap per sender:
  Redis key: ratelimit:{senderId}:{YYYY-MM-DDTHH} (UTC hour)
  Atomic Lua script on every send attempt:
    current = GET key
    if current >= maxEmailsPerHour: return "limit_hit"
    else: INCR key; EXPIRE key 3600; return "ok"

  Safe across multiple worker processes (Redis-backed, not memory).

  When limit is hit:
  - Job moved to next UTC hour window via moveToDelayed()
  - Order preserved (earlier jobs stay earlier in queue)
  - Slack notification fired to connected workspace
  - Job is NEVER dropped or permanently failed

### How Concurrency Works

  Worker concurrency: configurable via WORKER_CONCURRENCY env var
  Default: 5 parallel jobs

  Safe parallel execution because:
  - Idempotency guard checks DB status before every send
  - Rate limit uses atomic Redis Lua script (no race conditions)
  - BullMQ handles job locking internally

### Load Test Results

  50 jobs scheduled at same time
  Sender rate limit: 5 emails/hour
  Min delay: 2 seconds

  Result:
  - Hour 1: 5 emails sent (exactly at limit)
  - Remaining 45: deferred to next hour window
  - Zero double-sends
  - 2s gap enforced between each send
  - Zero failures

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Express.js + TypeScript | API server |
| Queue | BullMQ + Redis | Job scheduling |
| Database | PostgreSQL + Prisma | Source of truth |
| Search | Elasticsearch | Email search indexing |
| Email | Nodemailer + Ethereal | Fake SMTP sending |
| Auth | Passport.js + Google OAuth | User authentication |
| Notifications | Slack Webhooks | Rate limit alerts |
| Frontend | Next.js 14 + TypeScript | Dashboard UI |
| Styling | Tailwind CSS | UI styling |
| Data fetching | SWR | Client-side fetching |
| Containers | Docker Compose | Local infrastructure |

## Running Locally

### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL, Redis, Elasticsearch)
- Google OAuth credentials
- Slack app credentials (optional)

### Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd ReachInbox
npm install
```

### Step 2 — Start infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL 16 on port 5433
- Redis 7 on port 6379
- Elasticsearch 8.13 on port 9200

Wait 20 seconds for Elasticsearch to fully start.

### Step 3 — Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in values.
Copy `frontend/.env.local.example` to `frontend/.env.local`.

### Step 4 — Run database migration

```bash
npm run db:migrate
```

### Step 5 — Start the application

Terminal 1 (backend):
```bash
cd backend && npm run dev
```

Terminal 2 (frontend — Windows):
```bash
cd frontend
set NODE_OPTIONS=--max-old-space-size=4096
npm run dev
```

Terminal 2 (frontend — Mac/Linux):
```bash
cd frontend
export NODE_OPTIONS=--max-old-space-size=4096
npm run dev
```

### Step 6 — Open the app

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:5000](http://localhost:5000)
- BullMQ Board: [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues)
  *(requires Google login first)*

## Setting Up Ethereal Email

Ethereal is a fake SMTP service. No real emails are delivered.
All emails are captured in a test inbox.

Option A — Auto-create from the app (easiest):
1. Log in to the dashboard
2. Click Compose
3. Click "Create test sender" in the From field
4. An Ethereal account is automatically generated

Option B — Manual:
1. Go to https://ethereal.email
2. Click "Create Ethereal Account"
3. Copy the SMTP credentials shown

To view captured emails:
1. Go to https://ethereal.email
2. Log in with the sender credentials
3. All sent emails appear in the inbox

## Google OAuth Setup

1. Go to https://console.cloud.google.com
2. Create a new project named "ReachInbox"
3. APIs & Services → OAuth consent screen → External
4. Credentials → Create OAuth 2.0 Client ID → Web application
5. Authorized redirect URI:
   `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Secret to `backend/.env`

## Slack Setup (Optional)

1. Go to https://api.slack.com/apps
2. Create new app → From scratch
3. OAuth & Permissions → Add redirect URL:
   `http://localhost:5000/api/slack/oauth/callback`
4. Scopes: `incoming-webhook`
5. Enable Incoming Webhooks
6. Copy Client ID and Secret to `backend/.env`
7. In dashboard → Settings → Connect Slack

When a sender hits its hourly limit, a Slack Block Kit
message is sent to the connected channel automatically.

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/auth/google | No | Start Google OAuth |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/logout | Yes | Logout |
| POST | /api/emails/schedule | Yes | Schedule emails |
| GET | /api/emails/scheduled | Yes | List scheduled emails |
| GET | /api/emails/sent | Yes | List sent emails |
| GET | /api/emails/search | Yes | Search via Elasticsearch |
| DELETE | /api/emails/:id | Yes | Delete email job |
| PATCH | /api/emails/:id/archive | Yes | Archive email job |
| GET | /api/senders | Yes | List senders |
| POST | /api/senders/create-ethereal | Yes | Create test sender |
| GET | /api/slack/status | Yes | Slack connection status |
| GET | /api/slack/oauth/start | Yes | Start Slack OAuth |
| GET | /api/slack/oauth/callback | No | Slack OAuth callback |
| POST | /api/slack/disconnect | Yes | Disconnect Slack |
| GET | /admin/queues | Yes | BullMQ live dashboard |

## Assumptions and Trade-offs

1. Ethereal Email used for SMTP — no real emails delivered.
   Intentional for test/demo environment.

2. Elasticsearch runs without security (`xpack.security.enabled=false`)
   for local development. Production would need TLS and auth.

3. Sessions stored in Redis. If Redis is wiped, users need
   to log in again (sessions not persisted to DB).

4. Rate limiting uses UTC hour windows. A send at 11:59 PM
   and one at 12:00 AM count toward different windows.

5. Attachment support in compose is UI-only. Files are selected
   client-side but not transmitted via SMTP. Full attachment
   support would require multipart SMTP handling.

6. BullMQ dashboard at `/admin/queues` is protected by session
   auth. Production would need role-based access control.

7. Worker concurrency default is 5. Under high load, multiple
   worker instances can run as separate processes pointing
   to the same Redis instance.

8. Archived emails remain in PostgreSQL for audit purposes
   (soft delete via status field).
