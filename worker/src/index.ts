import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { z } from "zod";
import { AppError, errorBody } from "./lib/errors";
import type { AppBindings } from "./middleware/auth";
import { requireAuth, optionalAuth } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import { authRoutes } from "./routes/auth";
import { documentRoutes } from "./routes/documents";
import { publicJsonRoutes } from "./routes/publicJson";
import { analyticsRoutes } from "./routes/analytics";
import { adminRoutes } from "./routes/admin";
import { apiKeyRoutes } from "./routes/apiKeys";
import { aiRoutes } from "./routes/ai";
import { orgRoutes } from "./routes/orgs";
import { scimRoutes } from "./routes/scim";
import { findUserById, toPublicUser, updateProfile } from "./services/users";
import { getUserPlan } from "./services/plans";
import {
  processAnalyticsBatch,
  processExpireBatch,
  scanAndEnqueueExpired,
} from "./services/queues";
import type { AnalyticsQueueMessage, ExpireQueueMessage } from "./types";
import { openApiSpec } from "./openapi";
import { consumeOneTimeToken } from "./services/foldersOt";
import { getDocumentByPublicId, readDocumentBody } from "./services/documents";
import {
  attachD1Budget,
  d1BudgetRetryAfterSec,
  isD1BudgetExemptPath,
} from "./lib/d1Budget";

export { CollabRoom } from "./durable-objects/CollabRoom";

const app = new Hono<AppBindings>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

app.use("*", secureHeaders());

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = [c.env.APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"];
      // No Origin (same-origin / curl) → allow with APP_URL. Disallowed Origins → deny (no ACAO).
      if (!origin) return c.env.APP_URL;
      if (allowed.includes(origin)) return origin;
      return null;
    },
    allowHeaders: ["Content-Type", "Authorization", "X-Document-Password"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-Cache"],
    credentials: true,
  }),
);

app.use("*", optionalAuth);
app.use("/auth/*", rateLimit);
app.use("/documents/*", rateLimit);
app.use("/api-keys/*", rateLimit);
app.use("/ai/*", rateLimit);
app.use("/collab/*", rateLimit);
app.use("/api/*", rateLimit);
app.use("/json/*", rateLimit);
app.use("/analytics/*", rateLimit);
app.use("/admin/*", rateLimit);
app.use("/orgs/*", rateLimit);
app.use("/orgs", rateLimit);
app.use("/scim/*", rateLimit);
app.use("/profile", rateLimit);

app.get("/health", (c) => c.json({ ok: true, service: "jsonbob-api" }));

app.get("/ready", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    await c.env.CACHE.get("ready-check");
    return c.json({
      ok: true,
      d1: true,
      kv: true,
      r2: Boolean(c.env.DOCUMENTS),
      queues: Boolean(c.env.EXPIRE_QUEUE && c.env.ANALYTICS_QUEUE),
    });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 503);
  }
});

app.get("/api-docs", (c) => c.json(openApiSpec(c.env.API_URL)));
app.get("/api-docs/ui", (c) =>
  c.html(`<!doctype html>
<html>
  <head>
    <title>JSONBob API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      SwaggerUIBundle({ url: '/api-docs', dom_id: '#swagger' });
    </script>
  </body>
</html>`),
);

app.route("/auth", authRoutes);
app.route("/documents", documentRoutes);
app.route("/api-keys", apiKeyRoutes);
app.route("/ai", aiRoutes);
app.route("/analytics", analyticsRoutes);
app.route("/admin", adminRoutes);
app.route("/orgs", orgRoutes);
app.route("/scim/v2", scimRoutes);
app.route("/", publicJsonRoutes);

app.get("/collab/:roomId", async (c) => {
  const roomId = c.req.param("roomId")!;
  const ns = (c.env as Env & { COLLAB_ROOM?: DurableObjectNamespace }).COLLAB_ROOM;
  if (!ns) throw new AppError(501, "NOT_CONFIGURED", "Collaborative rooms are not configured");
  const id = ns.idFromName(roomId);
  const stub = ns.get(id);
  return stub.fetch(c.req.raw);
});

app.get("/ot/:token", async (c) => {
  const token = c.req.param("token")!;
  const documentId = await consumeOneTimeToken(c.env.DB, token);
  const doc = await getDocumentByPublicId(c.env.DB, documentId);
  if (!doc || doc.is_deleted) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  const content = await readDocumentBody(c.env.DOCUMENTS, doc);
  return c.json({ id: documentId, content, burned: true });
});

app.get("/profile", requireAuth, async (c) => {
  const auth = c.get("user")!;
  const user = await findUserById(c.env.DB, auth.sub);
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
  const plan = await getUserPlan(c.env.DB, user.id);
  return c.json({
    user: toPublicUser(user),
    plan: {
      role: plan.role,
      storageQuotaBytes: plan.storage_quota_bytes,
      documentQuota: plan.document_quota,
      apiRatePerMinute: plan.api_rate_per_minute,
      maxTtlDays: plan.max_ttl_days,
      versionRetention: plan.version_retention,
    },
  });
});

app.put("/profile", requireAuth, async (c) => {
  const auth = c.get("user")!;
  const body = z
    .object({
      name: z.string().min(1).max(120).optional(),
      password: z.string().min(8).max(128).optional(),
      currentPassword: z.string().min(1).optional(),
    })
    .parse(await c.req.json());
  const user = await updateProfile(c.env.DB, auth.sub, body);
  return c.json({ user: toPublicUser(user) });
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.flatten(),
          requestId,
        },
      },
      400,
    );
  }
  if (err instanceof AppError || err instanceof HTTPException) {
    const status = err instanceof AppError ? err.status : err.status;
    return c.json(errorBody(err as AppError, requestId), status);
  }
  console.error(JSON.stringify({ requestId, err: String(err) }));
  return c.json(
    {
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        details: null,
        requestId,
      },
    },
    500,
  );
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        details: null,
        requestId: c.get("requestId"),
      },
    },
    404,
  ),
);

async function handleQueue(batch: MessageBatch, env: Env): Promise<void> {
  const budget = attachD1Budget(env);
  if (await budget.isOverSoftLimit()) {
    console.warn("[d1-budget] soft limit reached — skipping queue batch", {
      queue: batch.queue,
      softLimit: budget.softLimit,
      usage: await budget.getUsage(),
    });
    return;
  }
  try {
    if (batch.queue.includes("expire")) {
      const messages = batch.messages.map((m) => m.body as ExpireQueueMessage);
      await processExpireBatch(budget.env, messages);
      return;
    }
    if (batch.queue.includes("analytics")) {
      const messages = batch.messages.map((m) => m.body as AnalyticsQueueMessage);
      await processAnalyticsBatch(budget.env, messages);
    }
  } finally {
    await budget.flush();
  }
}

async function handleScheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(
    (async () => {
      const budget = attachD1Budget(env);
      if (await budget.isOverSoftLimit()) {
        console.warn("[d1-budget] soft limit reached — skipping expire-scan cron", {
          softLimit: budget.softLimit,
          usage: await budget.getUsage(),
        });
        return;
      }
      try {
        const n = await scanAndEnqueueExpired(budget.env);
        console.log(JSON.stringify({ event: "expire-scan", enqueued: n }));
      } finally {
        await budget.flush();
      }
    })(),
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (isD1BudgetExemptPath(path)) return app.fetch(request, env, ctx);

    const budget = attachD1Budget(env);
    if (await budget.isOverHardLimit()) {
      return Response.json(
        {
          error: {
            code: "D1_BUDGET_EXCEEDED",
            message: "Daily database read budget reached. Try again after UTC midnight.",
          },
        },
        { status: 503, headers: { "Retry-After": String(d1BudgetRetryAfterSec()) } },
      );
    }
    try {
      return await app.fetch(request, budget.env, ctx);
    } finally {
      ctx.waitUntil(budget.flush());
    }
  },
  queue: handleQueue,
  scheduled: handleScheduled,
};
