export async function getCachedJson(cache: KVNamespace, documentId: string) {
  return cache.get(`cache:json:${documentId}`);
}

export async function setCachedJson(cache: KVNamespace, documentId: string, body: string) {
  await cache.put(`cache:json:${documentId}`, body, { expirationTtl: 60 });
}

export async function invalidateDocCache(cache: KVNamespace, documentId: string) {
  await cache.delete(`cache:json:${documentId}`);
  await cache.delete(`cache:meta:${documentId}`);
}
