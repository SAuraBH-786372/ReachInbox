import { Client } from '@elastic/elasticsearch';
import { config } from '../config';

const esClientConfig: ConstructorParameters<typeof Client>[0] = {
  node: config.elasticsearch.node,
  maxRetries: 3,
  requestTimeout: 10000,
};

// Support HTTP basic auth for hosted Elasticsearch (Bonsai, Elastic Cloud)
if (config.elasticsearch.username && config.elasticsearch.password) {
  esClientConfig.auth = {
    username: config.elasticsearch.username,
    password: config.elasticsearch.password,
  };
}

export const esClient = new Client(esClientConfig);

export const EMAILS_INDEX = config.elasticsearch.index; // "emails"

export async function checkElasticsearchHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  clusterName?: string;
  error?: string;
}> {
  try {
    const health = await esClient.cluster.health({});
    return {
      status: 'healthy',
      clusterName: health.cluster_name,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error?.message || 'Failed to connect to Elasticsearch',
    };
  }
}

export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipientEmail: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              senderId: { type: 'keyword' },
              userId: { type: 'keyword' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Initialized index: "${EMAILS_INDEX}"`);
    }
  } catch (error: any) {
    console.warn(`[Elasticsearch] Could not ensure index "${EMAILS_INDEX}":`, error.message);
  }
}

export interface EmailDocument {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  senderId: string;
  userId: string;
}

export async function indexEmailJob(doc: EmailDocument): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: doc.id,
      document: {
        id: doc.id,
        recipientEmail: doc.recipientEmail,
        subject: doc.subject,
        body: doc.body,
        status: doc.status,
        scheduledAt: doc.scheduledAt instanceof Date ? doc.scheduledAt.toISOString() : doc.scheduledAt,
        sentAt: doc.sentAt ? (doc.sentAt instanceof Date ? doc.sentAt.toISOString() : doc.sentAt) : null,
        senderId: doc.senderId,
        userId: doc.userId,
      },
    });
  } catch (error: any) {
    console.error(`[Elasticsearch] Failed to index EmailJob ${doc.id}:`, error.message);
  }
}

export interface SearchEmailsQuery {
  q?: string;
  status?: string;
  senderId?: string;
  recipientEmail?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function searchEmailsInES(params: SearchEmailsQuery): Promise<{ ids: string[]; total: number }> {
  try {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (params.q) {
      mustClauses.push({
        multi_match: {
          query: params.q,
          fields: ['subject^3', 'body', 'recipientEmail^2'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (params.status) {
      filterClauses.push({ term: { status: params.status } });
    }

    if (params.senderId) {
      filterClauses.push({ term: { senderId: params.senderId } });
    }

    if (params.recipientEmail) {
      filterClauses.push({ term: { recipientEmail: params.recipientEmail } });
    }

    if (params.from || params.to) {
      const rangeClause: any = {};
      if (params.from) rangeClause.gte = params.from;
      if (params.to) rangeClause.lte = params.to;
      filterClauses.push({ range: { scheduledAt: rangeClause } });
    }

    const query: any = {};
    if (mustClauses.length > 0 || filterClauses.length > 0) {
      query.bool = {
        must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
        filter: filterClauses,
      };
    } else {
      query.match_all = {};
    }

    const response = await esClient.search({
      index: EMAILS_INDEX,
      from,
      size: limit,
      query,
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = response.hits.hits;
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;
    const ids = hits.map((h: any) => h._id || h._source.id);

    return { ids, total };
  } catch (error: any) {
    console.error('[Elasticsearch] Search query failed:', error.message);
    return { ids: [], total: 0 };
  }
}
