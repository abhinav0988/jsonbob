import { Hono } from "hono";
import { z } from "zod";
import { signAccessToken, signRefreshToken } from "../lib/crypto";
import { AppError } from "../lib/errors";
import type { AppBindings } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import {
  authenticateUser,
  findUserById,
  registerUser,
  toPublicUser,
} from "../services/users";
import {
  isRefreshTokenValid,
  revokeRefreshToken,
  storeRefreshToken,
} from "../services/sessions";
import {
  exchangeGoogleCode,
  googleAuthUrl,
  googleConfigured,
  upsertGoogleUser,
} from "../services/googleAuth";
import {
  exchangeGithubCode,
  githubAuthUrl,
  githubConfigured,
  upsertGithubUser,
} from "../services/githubAuth";

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/register", async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const user = await registerUser(c.env.DB, body);
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signAccessToken(payload, c.env.JWT_ACCESS_SECRET);
  const refreshToken = await signRefreshToken(payload, c.env.JWT_REFRESH_SECRET);
  await storeRefreshToken(c.env.SESSIONS, refreshToken, user.id);
  return c.json({ user: toPublicUser(user), accessToken, refreshToken }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const user = await authenticateUser(c.env.DB, body.email, body.password);
  const payload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signAccessToken(payload, c.env.JWT_ACCESS_SECRET);
  const refreshToken = await signRefreshToken(payload, c.env.JWT_REFRESH_SECRET);
  await storeRefreshToken(c.env.SESSIONS, refreshToken, user.id);
  return c.json({ user: toPublicUser(user), accessToken, refreshToken });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshToken = (body as { refreshToken?: string }).refreshToken;
  if (refreshToken) await revokeRefreshToken(c.env.SESSIONS, refreshToken);
  return c.json({ ok: true });
});

authRoutes.post("/refresh", async (c) => {
  const body = refreshSchema.parse(await c.req.json());
  let payload;
  try {
    const { verifyRefreshToken } = await import("../lib/crypto");
    payload = await verifyRefreshToken(body.refreshToken, c.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid refresh token");
  }

  const valid = await isRefreshTokenValid(c.env.SESSIONS, body.refreshToken, payload.sub);
  if (!valid) throw new AppError(401, "UNAUTHORIZED", "Refresh token revoked or expired");

  const user = await findUserById(c.env.DB, payload.sub);
  if (!user || !user.is_active) throw new AppError(401, "UNAUTHORIZED", "User not found");

  await revokeRefreshToken(c.env.SESSIONS, body.refreshToken);
  const nextPayload = { sub: user.id, email: user.email, role: user.role };
  const accessToken = await signAccessToken(nextPayload, c.env.JWT_ACCESS_SECRET);
  const refreshToken = await signRefreshToken(nextPayload, c.env.JWT_REFRESH_SECRET);
  await storeRefreshToken(c.env.SESSIONS, refreshToken, user.id);

  return c.json({ accessToken, refreshToken, user: toPublicUser(user) });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const auth = c.get("user")!;
  const user = await findUserById(c.env.DB, auth.sub);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  return c.json({ user: toPublicUser(user) });
});

authRoutes.get("/google/status", (c) => {
  return c.json({ configured: googleConfigured(c.env) });
});

authRoutes.get("/google", async (c) => {
  if (!googleConfigured(c.env)) {
    throw new AppError(501, "NOT_CONFIGURED", "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets");
  }
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth:google:${state}`, "1", { expirationTtl: 600 });
  return c.redirect(googleAuthUrl(c.env, state), 302);
});

authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const err = c.req.query("error");
  if (err) {
    return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(err)}`, 302);
  }
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/login?error=missing_code`, 302);
  }
  const ok = await c.env.SESSIONS.get(`oauth:google:${state}`);
  if (!ok) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_state`, 302);
  }
  await c.env.SESSIONS.delete(`oauth:google:${state}`);

  try {
    const profile = await exchangeGoogleCode(c.env, code);
    const user = await upsertGoogleUser(c.env.DB, profile);
    const jwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await signAccessToken(jwtPayload, c.env.JWT_ACCESS_SECRET);
    const refreshToken = await signRefreshToken(jwtPayload, c.env.JWT_REFRESH_SECRET);
    await storeRefreshToken(c.env.SESSIONS, refreshToken, user.id);
    const q = new URLSearchParams({
      accessToken,
      refreshToken,
      user: JSON.stringify(toPublicUser(user)),
    });
    return c.redirect(`${c.env.APP_URL}/login/oauth?${q}`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(message)}`, 302);
  }
});

authRoutes.get("/github/status", (c) => {
  return c.json({ configured: githubConfigured(c.env) });
});

authRoutes.get("/github", async (c) => {
  if (!githubConfigured(c.env)) {
    throw new AppError(501, "NOT_CONFIGURED", "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET secrets");
  }
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth:github:${state}`, "1", { expirationTtl: 600 });
  return c.redirect(githubAuthUrl(c.env, state), 302);
});

authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const err = c.req.query("error");
  if (err) {
    return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(err)}`, 302);
  }
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/login?error=missing_code`, 302);
  }
  const ok = await c.env.SESSIONS.get(`oauth:github:${state}`);
  if (!ok) {
    return c.redirect(`${c.env.APP_URL}/login?error=invalid_state`, 302);
  }
  await c.env.SESSIONS.delete(`oauth:github:${state}`);

  try {
    const profile = await exchangeGithubCode(c.env, code);
    const user = await upsertGithubUser(c.env.DB, profile);
    const jwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await signAccessToken(jwtPayload, c.env.JWT_ACCESS_SECRET);
    const refreshToken = await signRefreshToken(jwtPayload, c.env.JWT_REFRESH_SECRET);
    await storeRefreshToken(c.env.SESSIONS, refreshToken, user.id);
    const q = new URLSearchParams({
      accessToken,
      refreshToken,
      user: JSON.stringify(toPublicUser(user)),
    });
    return c.redirect(`${c.env.APP_URL}/login/oauth?${q}`, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(message)}`, 302);
  }
});
