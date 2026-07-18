import type { Context, Next } from "hono";
import { verifyAccessToken } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { findUserByApiKey } from "../services/apiKeys";
import type { JwtPayload } from "../types";

export type AppBindings = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user?: JwtPayload;
  };
};

async function resolveBearerUser(
  token: string,
  env: Env,
): Promise<JwtPayload | null> {
  if (token.startsWith("jb_")) {
    const user = await findUserByApiKey(env.DB, token);
    if (!user) return null;
    return { sub: user.id, email: user.email, role: user.role };
  }
  try {
    return await verifyAccessToken(token, env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
}

export async function optionalAuth(c: Context<AppBindings>, next: Next) {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const payload = await resolveBearerUser(header.slice(7), c.env);
    if (payload) c.set("user", payload);
  }
  await next();
}

export async function requireAuth(c: Context<AppBindings>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
  }
  const payload = await resolveBearerUser(header.slice(7), c.env);
  if (!payload) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
  }
  c.set("user", payload);
  await next();
}
