import type { Context, Next } from "hono";
import type { AppBindings } from "./auth";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/crypto";

export async function requireAdmin(c: Context<AppBindings>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }
  try {
    const payload = await verifyAccessToken(header.slice(7), c.env.JWT_ACCESS_SECRET);
    c.set("user", payload);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
  }
  if (c.get("user")?.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin access required");
  }
  await next();
}
