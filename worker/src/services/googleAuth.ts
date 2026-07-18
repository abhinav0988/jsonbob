import { createId, nowIso } from "../lib/ids";
import { AppError } from "../lib/errors";
import type { UserRow } from "../types";
import { FREE_PLAN } from "../types";

export async function findUserByGoogleId(db: D1Database, googleId: string) {
  return db
    .prepare("SELECT * FROM users WHERE google_id = ?")
    .bind(googleId)
    .first<UserRow>();
}

export async function upsertGoogleUser(
  db: D1Database,
  input: { googleId: string; email: string; name: string },
) {
  const email = input.email.trim().toLowerCase();
  const byGoogle = await findUserByGoogleId(db, input.googleId);
  if (byGoogle) return byGoogle;

  const byEmail = await db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first<UserRow>();

  const now = nowIso();
  if (byEmail) {
    await db
      .prepare(`UPDATE users SET google_id = ?, name = COALESCE(NULLIF(?, ''), name), updated_at = ? WHERE id = ?`)
      .bind(input.googleId, input.name.trim(), now, byEmail.id)
      .run();
    const linked = await findUserByGoogleId(db, input.googleId);
    if (!linked) throw new AppError(500, "INTERNAL", "Failed to link Google account");
    return linked;
  }

  const id = createId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, google_id, storage_used_bytes, document_count, is_active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'free', ?, 0, 0, 1, ?, ?)`,
      )
      .bind(id, input.name.trim() || email.split("@")[0], email, input.googleId, now, now),
    db
      .prepare(
        `INSERT INTO user_plans (user_id, role, storage_quota_bytes, document_quota, api_rate_per_minute, max_ttl_days, version_retention, updated_at)
         VALUES (?, 'free', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        FREE_PLAN.storage_quota_bytes,
        FREE_PLAN.document_quota,
        FREE_PLAN.api_rate_per_minute,
        FREE_PLAN.max_ttl_days,
        FREE_PLAN.version_retention,
        now,
      ),
  ]);

  const user = await findUserById(db, id);
  if (!user) throw new AppError(500, "INTERNAL", "Failed to create Google user");
  return user;
}

async function findUserById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export function googleConfigured(env: Env) {
  const e = env as Env & { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(env: Env, state: string) {
  const e = env as Env & { GOOGLE_CLIENT_ID?: string };
  if (!e.GOOGLE_CLIENT_ID) throw new AppError(501, "NOT_CONFIGURED", "Google OAuth is not configured");
  const redirectUri = `${env.API_URL}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(env: Env, code: string) {
  const e = env as Env & { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) {
    throw new AppError(501, "NOT_CONFIGURED", "Google OAuth is not configured");
  }
  const redirectUri = `${env.API_URL}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new AppError(401, "UNAUTHORIZED", "Google token exchange failed");
  }
  const tokens = (await tokenRes.json()) as { access_token: string };
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) {
    throw new AppError(401, "UNAUTHORIZED", "Failed to fetch Google profile");
  }
  const profile = (await profileRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!profile.sub || !profile.email) {
    throw new AppError(400, "VALIDATION_ERROR", "Google profile missing email");
  }
  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name ?? profile.email.split("@")[0]!,
  };
}
