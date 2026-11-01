/**
 * Smoke: raw /json/:id must never be HTML.
 * Run against a live API (defaults to prod workers.dev).
 *
 *   JSONBOB_API_URL=https://jsonbob-api.abhinavmangal68.workers.dev npm run smoke
 */
const API = (process.env.JSONBOB_API_URL || "https://jsonbob-api.abhinavmangal68.workers.dev").replace(
  /\/$/,
  "",
);

async function main() {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);
  const hj = await health.json();
  if (!hj?.ok) throw new Error("health body not ok");

  const created = await fetch(`${API}/api/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ smoke: true, t: Date.now() }),
  });
  if (!created.ok) throw new Error(`create ${created.status}`);
  const body = await created.json();
  if (!body.id) throw new Error("missing id");

  const raw = await fetch(`${API}/json/${body.id}`);
  const ct = raw.headers.get("content-type") || "";
  if (!raw.ok) throw new Error(`raw ${raw.status}`);
  if (!ct.includes("application/json")) {
    throw new Error(`Expected application/json, got ${ct}`);
  }
  const text = await raw.text();
  if (text.trimStart().startsWith("<!")) {
    throw new Error("Raw URL returned HTML — frontend/API routing bug");
  }
  JSON.parse(text);
  console.log("smoke ok", body.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
