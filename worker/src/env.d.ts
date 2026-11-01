/** Extend Cloudflare Env with jsonbob bindings. */
interface Env {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  EXPIRE_QUEUE: Queue;
  ANALYTICS_QUEUE: Queue;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  APP_URL: string;
  API_URL: string;
  /** Daily D1 rows_read hard cap for this Worker (account free tier is 5M shared). */
  D1_DAILY_ROWS_READ_LIMIT?: string;
  AI?: Ai;
  COLLAB_ROOM?: DurableObjectNamespace;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
