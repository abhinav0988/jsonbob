import api from "./client";

export interface AnalyticsOverview {
  totalDocuments: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  documentQuota: number;
  apiRequestCount: number;
  recentDocuments: Array<{
    id: string;
    name: string | null;
    visibility: string;
    size: number;
    version: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function getAnalytics() {
  const { data } = await api.get<AnalyticsOverview>("/analytics");
  return data;
}

export async function getDocumentAnalytics(id: string) {
  const { data } = await api.get<{
    documentId: string;
    totalRequests: number;
    lastAccessedAt: string | null;
  }>(`/analytics/documents/${id}`);
  return data;
}

export async function getAdminAnalytics() {
  const { data } = await api.get<{
    totalUsers: number;
    totalDocuments: number;
    storageUsedBytes: number;
    apiRequestCount: number;
  }>("/analytics/admin");
  return data;
}

export async function getProfile() {
  const { data } = await api.get<{
    user: import("../types").PublicUser;
    plan: {
      role: string;
      storageQuotaBytes: number;
      documentQuota: number;
      apiRatePerMinute: number;
      maxTtlDays: number;
      versionRetention: number;
    };
  }>("/profile");
  return data;
}

export async function updateProfile(input: {
  name?: string;
  password?: string;
  currentPassword?: string;
}) {
  const { data } = await api.put<{ user: import("../types").PublicUser }>("/profile", input);
  return data.user;
}

export async function listAdminUsers() {
  const { data } = await api.get<{ items: import("../types").PublicUser[] }>("/admin/users");
  return data;
}

export async function patchAdminUser(
  id: string,
  body: { role?: "free" | "premium" | "admin"; isActive?: boolean },
) {
  const { data } = await api.patch<{ user: import("../types").PublicUser }>(
    `/admin/users/${id}`,
    body,
  );
  return data.user;
}

export async function listAdminDocuments(search?: string) {
  const { data } = await api.get<{ items: import("../types").DocumentSummary[] }>(
    "/admin/documents",
    { params: { search } },
  );
  return data;
}

export async function adminDeleteDocument(id: string) {
  await api.delete(`/admin/documents/${id}`);
}
