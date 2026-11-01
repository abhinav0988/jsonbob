/**
 * Live API feature smoke suite against production (or JSONBOB_API_URL).
 *
 *   npm run smoke:full --prefix frontend
 */
const API = (process.env.JSONBOB_API_URL || "https://jsonbob-api.abhinavmangal68.workers.dev").replace(
  /\/$/,
  "",
);
const WEB = (process.env.JSONBOB_WEB_URL || "https://jsonbob-web.abhinavmangal68.workers.dev").replace(
  /\/$/,
  "",
);

const email = `smoke_${Date.now()}@example.com`;
const password = "SmokeTest1!smoke";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}: ${detail}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json, text };
}

async function main() {
  console.log(`API ${API}`);
  console.log(`WEB ${WEB}\n`);

  console.log("## Routing / deploy");
  {
    const spaLogin = await fetch(`${WEB}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    // SPA worker must NOT accept POST /auth/login as the API — 405 is expected on web.
    // Browser clients must call API host instead.
    ok("web POST /auth/login is not the API (405)", spaLogin.status === 405, `got ${spaLogin.status}`);

    const apiLoginWrong = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nope@example.com", password: "bad" }),
    });
    ok(
      "api POST /auth/login responds (not 405)",
      apiLoginWrong.res.status !== 405 && apiLoginWrong.res.status < 500,
      `got ${apiLoginWrong.res.status}`,
    );

    const webHtml = await fetch(`${WEB}/login`);
    const html = await webHtml.text();
    ok("web /login serves SPA HTML", webHtml.ok && html.includes("<!"), `status ${webHtml.status}`);
    ok(
      "web bundle references API host",
      /jsonbob-api\.abhinavmangal68\.workers\.dev/.test(html) ||
        (await (async () => {
          const m = html.match(/\/assets\/[^"]+\.js/);
          if (!m) return false;
          const js = await (await fetch(`${WEB}${m[0]}`)).text();
          return js.includes("jsonbob-api.abhinavmangal68.workers.dev");
        })()),
      "API base missing from production assets",
    );
  }

  console.log("\n## Health");
  {
    const h = await req("/health");
    ok("GET /health", h.res.ok && h.json?.ok === true, JSON.stringify(h.json));
    const r = await req("/ready");
    ok("GET /ready", r.res.ok, `status ${r.res.status}`);
    const docs = await req("/api-docs");
    ok("GET /api-docs", docs.res.ok && Boolean(docs.json?.openapi || docs.json?.info), `status ${docs.res.status}`);
  }

  console.log("\n## CORS");
  {
    const opt = await fetch(`${API}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: WEB,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });
    ok("OPTIONS CORS allow web origin", opt.status === 204 || opt.status === 200, `status ${opt.status}`);
    ok(
      "ACA-Origin is web",
      opt.headers.get("access-control-allow-origin") === WEB,
      opt.headers.get("access-control-allow-origin") || "missing",
    );
  }

  console.log("\n## Auth + documents");
  let access = "";
  let refresh = "";
  let docId = "";
  {
    const reg = await req("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name: "Smoke Bot" }),
    });
    ok("POST /auth/register", reg.res.status === 201 || reg.res.status === 200, `status ${reg.res.status} ${JSON.stringify(reg.json)}`);
    access = reg.json?.accessToken || "";
    refresh = reg.json?.refreshToken || "";
    ok("register returns tokens", Boolean(access && refresh));

    const login = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    ok("POST /auth/login", login.res.ok && Boolean(login.json?.accessToken), `status ${login.res.status}`);
    access = login.json?.accessToken || access;

    const me = await req("/auth/me", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /auth/me", me.res.ok && me.json?.user?.email === email, `status ${me.res.status}`);

    const badLogin = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "wrong-password-xx" }),
    });
    ok("login rejects bad password", badLogin.res.status === 401 || badLogin.res.status === 400, `status ${badLogin.res.status}`);

    const created = await req("/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({
        name: "smoke-doc",
        visibility: "public",
        content: { smoke: true, t: Date.now(), nested: { a: 1 } },
      }),
    });
    docId = created.json?.id || created.json?.document?.id || created.json?.document_id || "";
    ok("POST /documents", created.res.ok && Boolean(docId), `status ${created.res.status} ${JSON.stringify(created.json).slice(0, 200)}`);

    const list = await req("/documents?limit=5", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /documents", list.res.ok, `status ${list.res.status}`);

    const get = await req(`/documents/${docId}`, { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /documents/:id", get.res.ok, `status ${get.res.status}`);

    const raw = await req(`/json/${docId}`);
    ok("GET /json/:id public raw", raw.res.ok && typeof raw.json === "object", `status ${raw.res.status}`);
    ok("raw is JSON not HTML", !String(raw.text).trimStart().startsWith("<!"));

    const put = await req(`/documents/${docId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({ content: { smoke: true, updated: true } }),
    });
    ok("PUT /documents/:id", put.res.ok, `status ${put.res.status}`);

    const dup = await req(`/documents/${docId}/duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    });
    ok("POST /documents/:id/duplicate", dup.res.ok, `status ${dup.res.status}`);

    const fav = await req(`/documents/${docId}/favorite`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({ favorite: true }),
    });
    ok("PUT /documents/:id/favorite", fav.res.ok || fav.res.status === 204, `status ${fav.res.status}`);

    const tags = await req(`/documents/${docId}/tags`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({ tags: ["smoke"] }),
    });
    ok("PUT /documents/:id/tags", tags.res.ok || tags.res.status === 204, `status ${tags.res.status}`);

    const folders = await req("/documents/folders", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /documents/folders", folders.res.ok, `status ${folders.res.status}`);

    const folderPut = await req(`/documents/${docId}/folder`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({ folder: "smoke-folder" }),
    });
    ok("PUT /documents/:id/folder", folderPut.res.ok, `status ${folderPut.res.status}`);

    const schemaPut = await req(`/documents/${docId}/schema`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({
        schema: JSON.stringify({ type: "object", properties: { smoke: { type: "boolean" } } }),
      }),
    });
    ok("PUT /documents/:id/schema", schemaPut.res.ok, `status ${schemaPut.res.status}`);

    const schemaGet = await req(`/documents/${docId}/schema`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    ok(
      "GET /documents/:id/schema",
      schemaGet.res.ok && Boolean(schemaGet.json?.schema),
      `status ${schemaGet.res.status}`,
    );

    const versions = await req(`/documents/${docId}/versions`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    ok("GET /documents/:id/versions", versions.res.ok, `status ${versions.res.status}`);

    const ot = await req(`/documents/${docId}/one-time`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    });
    ok("POST /documents/:id/one-time", ot.res.ok && Boolean(ot.json?.token || ot.json?.url), `status ${ot.res.status}`);

    const profile = await req("/profile", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /profile", profile.res.ok, `status ${profile.res.status}`);

    const audit = await req("/documents/audit", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /documents/audit", audit.res.ok, `status ${audit.res.status}`);

    const orgs = await req("/orgs", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /orgs", orgs.res.ok || orgs.res.status === 404, `status ${orgs.res.status}`);

    const analytics = await req("/analytics", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /analytics", analytics.res.ok, `status ${analytics.res.status}`);

    const keys = await req("/api-keys", { headers: { Authorization: `Bearer ${access}` } });
    ok("GET /api-keys", keys.res.ok, `status ${keys.res.status}`);

    const anon = await req("/api/json", {
      method: "POST",
      body: JSON.stringify({ anon: true, t: Date.now() }),
    });
    const anonId = anon.json?.id;
    ok("POST /api/json anonymous", anon.res.ok && Boolean(anonId), `status ${anon.res.status}`);

    const refreshRes = await req("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refresh }),
    });
    ok("POST /auth/refresh", refreshRes.res.ok && Boolean(refreshRes.json?.accessToken), `status ${refreshRes.res.status}`);
    if (refreshRes.json?.accessToken) access = refreshRes.json.accessToken;

    const google = await req("/auth/google/status");
    ok("GET /auth/google/status", google.res.ok && typeof google.json?.configured === "boolean", `status ${google.res.status}`);
    const github = await req("/auth/github/status");
    ok("GET /auth/github/status", github.res.ok && typeof github.json?.configured === "boolean", `status ${github.res.status}`);

    if (docId) {
      const soft = await req(`/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}` },
      });
      ok("DELETE /documents/:id", soft.res.ok || soft.res.status === 204, `status ${soft.res.status}`);

      const trash = await req("/documents/trash", { headers: { Authorization: `Bearer ${access}` } });
      ok("GET /documents/trash", trash.res.ok, `status ${trash.res.status}`);
    }
  }

  console.log("\n## AI");
  {
    const ai = await req("/ai/assist", {
      method: "POST",
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: JSON.stringify({
        prompt: "Explain this JSON briefly",
        jsonText: JSON.stringify({ a: 1, smoke: true }),
      }),
    });
    ok("POST /ai/assist status ok", ai.res.ok, `status ${ai.res.status} ${JSON.stringify(ai.json).slice(0, 180)}`);
    ok("POST /ai/assist returns reply", Boolean(ai.json?.reply), `body ${JSON.stringify(ai.json).slice(0, 180)}`);
  }

  console.log(`\n———\n${passed} passed · ${failed} failed`);
  if (failed) {
    for (const f of failures) console.error("FAIL:", f);
    process.exit(1);
  }
  console.log("smoke:full ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
