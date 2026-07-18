/** Shared API domain types consumed by frontend and documented in worker OpenAPI. */

export type Role = "free" | "premium" | "admin";
export type Visibility = "public" | "private" | "password";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storageUsedBytes: number;
  documentCount: number;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  name: string | null;
  visibility: Visibility;
  size: number;
  version: number;
  expireAt: string | null;
  url: string;
  apiUrl: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  favorite?: boolean;
  folder?: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: unknown;
}

export interface CreateDocumentResponse {
  id: string;
  url: string;
  apiUrl: string;
  visibility: Visibility;
  size: number;
  version: number;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  meta: unknown;
  createdAt: string;
}
