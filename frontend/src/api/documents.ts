import api from "./client";
import type { CreateDocumentResponse, DocumentDetail, DocumentSummary } from "../types";

export async function createRawJson(content: unknown) {
  const { data } = await api.post<{ id: string; url: string }>("/api/json", content);
  return data;
}

export async function createDocument(input: {
  content: unknown;
  visibility?: "public" | "private" | "password";
  name?: string | null;
  expireAt?: string | null;
  password?: string | null;
}) {
  const { data } = await api.post<CreateDocumentResponse>("/documents", input);
  return data;
}

export async function listDocuments(params?: {
  search?: string;
  page?: number;
  visibility?: string;
  from?: string;
  to?: string;
  folder?: string;
  tag?: string;
  favorite?: boolean;
}) {
  const { data } = await api.get<{ items: DocumentSummary[]; page: number; limit: number }>(
    "/documents",
    {
      params: {
        search: params?.search,
        page: params?.page,
        visibility: params?.visibility,
        from: params?.from,
        to: params?.to,
        folder: params?.folder,
        tag: params?.tag,
        favorite: params?.favorite ? "1" : undefined,
      },
    },
  );
  return data;
}

export async function getDocument(id: string, password?: string) {
  const { data } = await api.get<DocumentDetail>(`/documents/${id}`, {
    headers: password ? { "X-Document-Password": password } : undefined,
  });
  return data;
}

export async function updateDocument(id: string, content: unknown) {
  const { data } = await api.put<{ id: string; version: number }>(`/documents/${id}`, {
    content,
  });
  return data;
}

export async function patchDocument(
  id: string,
  body: {
    name?: string | null;
    visibility?: "public" | "private" | "password";
    expireAt?: string | null;
    password?: string | null;
  },
) {
  const { data } = await api.patch<DocumentSummary>(`/documents/${id}`, body);
  return data;
}

export async function deleteDocument(id: string) {
  const { data } = await api.delete<{ ok: boolean }>(`/documents/${id}`);
  return data;
}

export async function duplicateDocument(id: string) {
  const { data } = await api.post<CreateDocumentResponse>(`/documents/${id}/duplicate`);
  return data;
}

export async function listVersions(id: string) {
  const { data } = await api.get<{
    items: Array<{ version: number; size: number; createdBy: string | null; createdAt: string }>;
  }>(`/documents/${id}/versions`);
  return data;
}

export async function restoreVersion(id: string, version: number) {
  const { data } = await api.post<{ id: string; restoredFrom: number; version: number }>(
    `/documents/${id}/versions/${version}/restore`,
  );
  return data;
}

export async function fetchRawJson(id: string, password?: string) {
  const { data } = await api.get<unknown>(`/json/${id}`, {
    headers: password ? { "X-Document-Password": password } : undefined,
  });
  return data;
}
