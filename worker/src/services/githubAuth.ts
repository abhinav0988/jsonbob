import { createId, nowIso } from "../lib/ids";
import { AppError } from "../lib/errors";
import type { UserRow } from "../types";
import { FREE_PLAN } from "../types";

export async function findUserByGithubId(db: D1Database, githubId: string) {
  return db
    .prepare("SELECT * FROM users WHERE github_id = ?")
    .bind(githubId)
    .first<UserRow>();
}

export async function upsertGithubUser(
  db: D1Database,
  input: { githubId: string; email: string; name: string },
) {
  const email = input.email.trim().toLowerCase();
  const byGithub = await findUserByGithubId(db, input.githubId);
  if (byGithub) return byGithub;

  const byEmail = await db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .bind(email)
    .first<UserRow>();

  const now = nowIso();
  if (byEmail) {
    await db
      .prepare(
        `UPDATE users SET github_id = ?, name = COALESCE(NULLIF(?, ''), name), updated_at = ? WHERE id = ?`,
      )
      .bind(input.githubId, input.name.trim(), now, byEmail.id)
      .run();
    const linked = await findUserByGithubId(db, input.githubId);
    if (!linked) throw new AppError(500, "INTERNAL", "Failed to link GitHub account");
    return linked;
  }

  const id = createId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, github_id, storage_used_bytes, document_count, is_active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'free', ?, 0, 0, 1, ?, ?)`,
      )
      .bind(id, input.name.trim() || email.split("@")[0], email, input.githubId, now, now),
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
  if (!user) throw new AppError(500, "INTERNAL", "Failed to create GitHub user");
  return user;
}

async function findUserById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export function githubConfigured(env: Env) {
  const e = env as Env & { GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string };
  return Boolean(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET);
}

export function githubAuthUrl(env: Env, state: string) {
  const e = env as Env & { GITHUB_CLIENT_ID?: string };
  if (!e.GITHUB_CLIENT_ID) throw new AppError(501, "NOT_CONFIGURED", "GitHub OAuth is not configured");
  const redirectUri = `${env.API_URL}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: e.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGithubCode(env: Env, code: string) {
  const e = env as Env & { GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string };
  if (!e.GITHUB_CLIENT_ID || !e.GITHUB_CLIENT_SECRET) {
    throw new AppError(501, "NOT_CONFIGURED", "GitHub OAuth is not configured");
  }
  const redirectUri = `${env.API_URL}/auth/github/callback`;
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: e.GITHUB_CLIENT_ID,
      client_secret: e.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new AppError(401, "UNAUTHORIZED", "GitHub token exchange failed");
  }
  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokens.access_token) {
    throw new AppError(401, "UNAUTHORIZED", tokens.error ?? "GitHub token exchange failed");
  }

  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "jsonbob",
    },
  });
  if (!profileRes.ok) {
    throw new AppError(401, "UNAUTHORIZED", "Failed to fetch GitHub profile");
  }
  const profile = (await profileRes.json()) as {
    id: number;
    login?: string;
    name?: string | null;
    email?: string | null;
  };

  let email = profile.email?.trim() || null;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "jsonbob",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((x) => x.primary && x.verified) ?? emails.find((x) => x.verified) ?? emails[0];
      email = primary?.email ?? null;
    }
  }

  if (!profile.id || !email) {
    throw new AppError(400, "VALIDATION_ERROR", "GitHub profile missing email");
  }

  return {
    githubId: String(profile.id),
    email,
    name: profile.name?.trim() || profile.login || email.split("@")[0]!,
  };
}
