import type { Context, Next } from "hono";
import type { AppBindings } from "./auth";
import { AppError } from "../lib/errors";
import { ANON_LIMITS, FREE_PLAN } from "../types";
import { getUserPlan } from "../services/plans";

export async function rateLimit(c: Context<AppBindings>, next: Next) {
  const user = c.get("user");
  let limit: number = ANON_LIMITS.api_rate_per_minute;

  if (user) {
    try {
      const plan = await getUserPlan(c.env.DB, user.sub);
      limit = plan.api_rate_per_minute;
    } catch {
      limit = FREE_PLAN.api_rate_per_minute;
    }
  }

  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "local";
  const key = user ? `rl:user:${user.sub}` : `rl:ip:${ip}`;
  const current = Number((await c.env.CACHE.get(key)) || "0");
  if (current >= limit) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  }
  await c.env.CACHE.put(key, String(current + 1), { expirationTtl: 60 });
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, limit - current - 1)));
  await next();
}
