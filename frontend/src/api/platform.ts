import api from "./client";

export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function listApiKeys() {
  const { data } = await api.get<{ items: ApiKeySummary[] }>("/api-keys");
  return data;
}

export async function createApiKey(name: string) {
  const { data } = await api.post<{ id: string; key: string; name: string; prefix: string }>(
    "/api-keys",
    { name },
  );
  return data;
}

export async function revokeApiKey(id: string) {
  const { data } = await api.delete<{ ok: boolean }>(`/api-keys/${id}`);
  return data;
}

export async function listTrash() {
  const { data } = await api.get<{ items: import("../types").DocumentSummary[] }>("/documents/trash");
  return data;
}

export async function restoreTrash(id: string) {
  const { data } = await api.post<{ ok: boolean }>(`/documents/trash/${id}/restore`);
  return data;
}

export async function purgeTrash(id: string) {
  const { data } = await api.delete<{ ok: boolean }>(`/documents/trash/${id}`);
  return data;
}

export async function googleStatus() {
  const { data } = await api.get<{ configured: boolean }>("/auth/google/status");
  return data;
}

export async function githubStatus() {
  const { data } = await api.get<{ configured: boolean }>("/auth/github/status");
  return data;
}

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: string;
  role?: string;
};

export async function listOrgs() {
  const { data } = await api.get<{ items: OrgSummary[] }>("/orgs");
  return data;
}

export async function createOrg(input: { name: string; slug?: string }) {
  const { data } = await api.post<{ org: OrgSummary }>("/orgs", input);
  return data;
}

export async function addOrgMember(
  orgId: string,
  input: { userId: string; role?: string },
) {
  const { data } = await api.post<{
    member: {
      orgId: string;
      userId: string;
      role: string;
      createdAt: string;
    } | null;
  }>(`/orgs/${orgId}/members`, input);
  return data;
}

export async function createServerOneTimeLink(documentId: string) {
  const { data } = await api.post<{ token: string; url: string }>(
    `/documents/${documentId}/one-time`,
  );
  return data;
}

export async function setServerFolder(documentId: string, folder: string | null) {
  const { data } = await api.put<{ ok: boolean; folder: string | null }>(
    `/documents/${documentId}/folder`,
    { folder },
  );
  return data;
}

export async function listServerFolders() {
  const { data } = await api.get<{
    folders: Array<{ folder: string; c: number }>;
    map: Record<string, string>;
  }>("/documents/folders");
  return data;
}

export async function setDocumentTags(documentId: string, tags: string[]) {
  const { data } = await api.put<{ ok: boolean; tags: string[] }>(`/documents/${documentId}/tags`, {
    tags,
  });
  return data;
}

export async function setDocumentFavorite(documentId: string, favorite: boolean) {
  const { data } = await api.put<{ ok: boolean; favorite: boolean }>(
    `/documents/${documentId}/favorite`,
    { favorite },
  );
  return data;
}

export async function fetchDocumentMeta() {
  const { data } = await api.get<{
    folders: Array<{ folder: string; c: number }>;
    folderMap: Record<string, string>;
    tags: Record<string, string[]>;
    favorites: string[];
  }>("/documents/meta");
  return data;
}

export async function getDocumentSchema(documentId: string) {
  const { data } = await api.get<{ schema: string | null }>(`/documents/${documentId}/schema`);
  return data;
}

export async function putDocumentSchema(documentId: string, schema: string | null) {
  const { data } = await api.put<{ ok: boolean; schema: string | null }>(
    `/documents/${documentId}/schema`,
    { schema },
  );
  return data;
}

export async function listAuditLog(limit = 40) {
  const { data } = await api.get<{
    items: Array<{
      id: string;
      action: string;
      resourceType: string | null;
      resourceId: string | null;
      meta: unknown;
      createdAt: string;
    }>;
  }>("/documents/audit", { params: { limit } });
  return data;
}

export type AiAssistSource = "workers-ai" | "local" | "local-fallback";

export async function aiAssist(prompt: string, jsonText: string) {
  const { data } = await api.post<{ reply: string; source: AiAssistSource }>("/ai/assist", {
    prompt,
    jsonText,
  });
  return data;
}
