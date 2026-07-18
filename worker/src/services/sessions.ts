import { sha256Hex } from "../lib/crypto";

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function storeRefreshToken(sessions: KVNamespace, token: string, userId: string) {
  const hash = await sha256Hex(token);
  await sessions.put(`rt:${hash}`, userId, { expirationTtl: REFRESH_TTL_SECONDS });
  await sessions.put(`sess:${userId}`, hash, { expirationTtl: REFRESH_TTL_SECONDS });
}

export async function revokeRefreshToken(sessions: KVNamespace, token: string) {
  const hash = await sha256Hex(token);
  const userId = await sessions.get(`rt:${hash}`);
  await sessions.delete(`rt:${hash}`);
  if (userId) await sessions.delete(`sess:${userId}`);
}

export async function isRefreshTokenValid(sessions: KVNamespace, token: string, userId: string) {
  const hash = await sha256Hex(token);
  const stored = await sessions.get(`rt:${hash}`);
  return stored === userId;
}
