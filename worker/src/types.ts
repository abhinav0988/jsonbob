export type { Role, Visibility, PublicUser } from "../../shared/types";
import type { Role, Visibility } from "../../shared/types";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: Role;
  google_id: string | null;
  github_id: string | null;
  storage_used_bytes: number;
  document_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  document_id: string;
  user_id: string | null;
  name: string | null;
  visibility: Visibility;
  password_hash: string | null;
  r2_key: string;
  size: number;
  content_type: string;
  expire_at: string | null;
  version: number;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  content_preview?: string | null;
}

export interface DocumentVersionRow {
  id: string;
  document_id: string;
  version: number;
  r2_key: string;
  size: number;
  created_by: string | null;
  created_at: string;
}

export interface UserPlanRow {
  user_id: string;
  role: Role;
  storage_quota_bytes: number;
  document_quota: number;
  api_rate_per_minute: number;
  max_ttl_days: number;
  version_retention: number;
  updated_at: string;
}

export const FREE_PLAN = {
  storage_quota_bytes: 10 * 1024 * 1024,
  document_quota: 50,
  api_rate_per_minute: 60,
  max_ttl_days: 7,
  version_retention: 5,
} as const;

export const PREMIUM_PLAN = {
  storage_quota_bytes: 1024 * 1024 * 1024,
  document_quota: 5000,
  api_rate_per_minute: 600,
  max_ttl_days: 365,
  version_retention: 50,
} as const;

export const ADMIN_PLAN = {
  storage_quota_bytes: 10 * 1024 * 1024 * 1024,
  document_quota: 100_000,
  api_rate_per_minute: 2000,
  max_ttl_days: 3650,
  version_retention: 200,
} as const;

export const ANON_LIMITS = {
  max_size_bytes: 100 * 1024,
  api_rate_per_minute: 30,
  max_ttl_days: 1,
} as const;

export type ExpireQueueMessage = {
  type: "purge-document";
  documentId: string;
};

export type AnalyticsQueueMessage = {
  type: "request";
  documentId: string;
  userId: string | null;
  ipHash: string;
  userAgent: string | null;
  method: string;
  statusCode: number;
  createdAt: string;
};
