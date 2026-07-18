export function openApiSpec(serverUrl: string) {
  const bearer = [{ bearerAuth: [] }];
  const ok = { "200": { description: "OK" } };
  const created = { "201": { description: "Created" } };
  const idParam = {
    name: "id",
    in: "path" as const,
    required: true,
    schema: { type: "string" },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "JSONBob API",
      version: "1.2.0",
      description:
        "JSON storage platform — Cloudflare Workers + D1 + R2 + KV + Durable Objects + Workers AI",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/health": { get: { summary: "Health", responses: ok } },
      "/ready": { get: { summary: "Readiness (D1/KV)", responses: ok } },
      "/api/json": {
        post: { summary: "Create JSON blob (JSONBlob-compatible)", responses: created },
      },
      "/json/{id}": {
        get: { summary: "Get raw JSON by id", parameters: [idParam], responses: ok },
        put: { summary: "Replace raw JSON by id", parameters: [idParam], responses: ok },
        delete: { summary: "Delete raw JSON by id", parameters: [idParam], responses: ok },
      },
      "/ot/{token}": {
        get: {
          summary: "Consume one-time burn token and return JSON",
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" }, "410": { description: "Already used" } },
        },
      },
      "/auth/register": { post: { summary: "Register", responses: created } },
      "/auth/login": { post: { summary: "Login", responses: ok } },
      "/auth/logout": { post: { summary: "Logout", responses: ok } },
      "/auth/refresh": { post: { summary: "Refresh tokens", responses: ok } },
      "/auth/me": { get: { summary: "Current user", security: bearer, responses: ok } },
      "/auth/google/status": { get: { summary: "Google OAuth configured?", responses: ok } },
      "/auth/google": {
        get: { summary: "Start Google OAuth", responses: { "302": { description: "Redirect" } } },
      },
      "/auth/google/callback": {
        get: { summary: "Google OAuth callback", responses: { "302": { description: "Redirect" } } },
      },
      "/documents": {
        get: {
          summary: "List documents",
          security: bearer,
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "visibility", in: "query", schema: { type: "string" } },
            { name: "folder", in: "query", schema: { type: "string" } },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "favorite", in: "query", schema: { type: "string", enum: ["1", "true"] } },
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: ok,
        },
        post: { summary: "Create document", security: bearer, responses: created },
      },
      "/documents/meta": {
        get: { summary: "Folders, tags, favorites map", security: bearer, responses: ok },
      },
      "/documents/audit": {
        get: { summary: "Owner audit log", security: bearer, responses: ok },
      },
      "/documents/folders": {
        get: { summary: "List folders", security: bearer, responses: ok },
      },
      "/documents/trash": {
        get: { summary: "List trash", security: bearer, responses: ok },
      },
      "/documents/trash/{id}/restore": {
        post: { summary: "Restore from trash", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/trash/{id}": {
        delete: { summary: "Purge trash item", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}": {
        get: { summary: "Get document", parameters: [idParam], responses: ok },
        put: { summary: "Update content", parameters: [idParam], responses: ok },
        patch: { summary: "Update metadata", security: bearer, parameters: [idParam], responses: ok },
        delete: { summary: "Soft-delete document", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/download": {
        get: { summary: "Download document JSON", parameters: [idParam], responses: ok },
      },
      "/documents/{id}/folder": {
        put: { summary: "Set document folder", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/tags": {
        put: { summary: "Set document tags", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/favorite": {
        put: { summary: "Set favorite", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/schema": {
        get: { summary: "Get attached JSON Schema", security: bearer, parameters: [idParam], responses: ok },
        put: { summary: "Attach JSON Schema", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/one-time": {
        post: {
          summary: "Mint one-time burn link",
          security: bearer,
          parameters: [idParam],
          responses: created,
        },
      },
      "/documents/{id}/duplicate": {
        post: { summary: "Duplicate document", security: bearer, parameters: [idParam], responses: created },
      },
      "/documents/{id}/versions": {
        get: { summary: "List versions", security: bearer, parameters: [idParam], responses: ok },
      },
      "/documents/{id}/versions/{version}": {
        get: {
          summary: "Get version content",
          security: bearer,
          parameters: [
            idParam,
            { name: "version", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: ok,
        },
      },
      "/documents/{id}/versions/{version}/restore": {
        post: {
          summary: "Restore version",
          security: bearer,
          parameters: [
            idParam,
            { name: "version", in: "path", required: true, schema: { type: "integer" } },
          ],
          responses: ok,
        },
      },
      "/api-keys": {
        get: { summary: "List API keys", security: bearer, responses: ok },
        post: { summary: "Create API key", security: bearer, responses: created },
      },
      "/api-keys/{id}": {
        delete: { summary: "Revoke API key", security: bearer, parameters: [idParam], responses: ok },
      },
      "/ai/assist": {
        post: { summary: "Workers AI assist", security: bearer, responses: ok },
      },
      "/collab/{roomId}": {
        get: {
          summary: "Collab Durable Object WebSocket upgrade",
          responses: { "101": { description: "Switching Protocols" } },
        },
      },
      "/analytics": { get: { summary: "Owner analytics", security: bearer, responses: ok } },
      "/analytics/documents/{id}": {
        get: { summary: "Document analytics", security: bearer, parameters: [idParam], responses: ok },
      },
      "/analytics/admin": {
        get: { summary: "Admin analytics", security: bearer, responses: ok },
      },
      "/profile": {
        get: { summary: "Profile", security: bearer, responses: ok },
        put: { summary: "Update profile", security: bearer, responses: ok },
      },
      "/admin/users": { get: { summary: "Admin list users", security: bearer, responses: ok } },
      "/admin/users/{id}": {
        patch: { summary: "Admin patch user", security: bearer, parameters: [idParam], responses: ok },
      },
      "/admin/documents": { get: { summary: "Admin list documents", security: bearer, responses: ok } },
      "/admin/documents/{id}": {
        delete: { summary: "Admin delete document", security: bearer, parameters: [idParam], responses: ok },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  };
}
