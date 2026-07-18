import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const createId = customAlphabet(alphabet, 21);
export const createDocumentId = customAlphabet(alphabet, 12);

export function nowIso() {
  return new Date().toISOString();
}

export function r2Key(userId: string | null, documentId: string, version?: number) {
  const owner = userId ?? "anonymous";
  if (version === undefined) {
    return `documents/${owner}/${documentId}.json`;
  }
  return `documents/${owner}/${documentId}/v/${version}.json`;
}
