/** Canonical API origin. Must be absolute in production — relative URLs hit the SPA worker (405). */
export const PROD_API_FALLBACK = "https://jsonbob-api.appsphere.workers.dev";

/** Pure resolver — unit-testable without Vite `import.meta.env`. */
export function resolveApiBaseUrl(
  envUrl: string | undefined | null,
  isProd: boolean,
  fallback = PROD_API_FALLBACK,
): string {
  const raw = typeof envUrl === "string" ? envUrl.trim() : "";
  const fromEnv = raw ? raw.replace(/\/$/, "") : "";
  if (fromEnv) return fromEnv;
  if (isProd) return fallback;
  return "";
}

export function getApiBaseUrl(): string {
  const fromVite = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const isProd = Boolean(import.meta.env.PROD);
  const base = resolveApiBaseUrl(fromVite, isProd);
  if (!fromVite?.trim() && isProd) {
    console.warn("[jsonbob] VITE_API_BASE_URL missing in production build; using", PROD_API_FALLBACK);
  }
  return base;
}
