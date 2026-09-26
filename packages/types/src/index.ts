export type EmailJobStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'archived';

export interface User {
  id: string;
  googleId?: string | null;
  name?: string | null;
  email: string;
  avatarUrl?: string | null;
  createdAt: string | Date;
}

export type AuthUser = User;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  previewUrlBase?: string;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  smtpConfigJson: SmtpConfig | Record<string, unknown>;
  createdAt: string | Date;
}

export interface EmailJob {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailJobStatus;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  bullJobId?: string | null;
  batchId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface SlackIntegration {
  id: string;
  userId: string;
  teamId?: string | null;
  accessToken?: string | null;
  webhookUrl: string;
  channel?: string | null;
  connectedAt: string | Date;
}

export interface SlackStatus {
  connected: boolean;
  channel: string | null;
  teamName: string | null;
}

export interface RateLimitConfig {
  id: string;
  senderId?: string | null;
  maxEmailsPerHour: number;
  minDelaySeconds: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ScheduleEmailPayload {
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  senderId?: string;
  batchId?: string;
}

export interface EmailSearchParams {
  query?: string;
  status?: EmailJobStatus;
  senderId?: string;
  recipientEmail?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    postgres: { status: 'healthy' | 'unhealthy'; error?: string };
    redis: { status: 'healthy' | 'unhealthy'; error?: string };
    elasticsearch: { status: 'healthy' | 'unhealthy'; clusterName?: string; error?: string };
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
