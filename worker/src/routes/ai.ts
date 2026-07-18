import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../middleware/auth";
import { optionalAuth } from "../middleware/auth";

export const aiRoutes = new Hono<AppBindings>();

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  jsonText: z.string().max(200_000).default(""),
});

aiRoutes.post("/assist", optionalAuth, async (c) => {
  const body = bodySchema.parse(await c.req.json());
  const snippet = body.jsonText.slice(0, 12_000);
  const system = `You are jsonbob, a concise JSON IDE assistant on Cloudflare.
Help with explaining JSON, suggesting schemas, TypeScript types, and fix tips.
Keep answers short and practical. If JSON is invalid, say so first.`;

  const local = localAssist(body.prompt, body.jsonText);
  const ai = c.env.AI;
  if (!ai) {
    return c.json({ reply: local, source: "local" });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `User question:\n${body.prompt}\n\nJSON document (may be truncated):\n\`\`\`json\n${snippet || "{}"}\n\`\`\``,
        },
      ],
      max_tokens: 600,
    })) as { response?: string };

    const reply = (result.response ?? "").trim() || local;
    return c.json({ reply, source: "workers-ai" });
  } catch (err) {
    console.error("AI.run failed", String(err));
    return c.json({ reply: local, source: "local-fallback" });
  }
});

function localAssist(prompt: string, jsonText: string): string {
  const p = prompt.toLowerCase();
  try {
    const data = JSON.parse(jsonText || "null");
    if (p.includes("schema")) {
      return `Suggested shape:\n${JSON.stringify(
        {
          type: Array.isArray(data)
            ? "array"
            : data && typeof data === "object"
              ? "object"
              : typeof data,
        },
        null,
        2,
      )}`;
    }
    if (p.includes("explain") || p.includes("summar")) {
      return `Document type: ${Array.isArray(data) ? `array(${data.length})` : typeof data}. Bytes≈${new TextEncoder().encode(jsonText).length}.`;
    }
    if (p.includes("typescript") || p.includes("type")) {
      return "Describe key fields and ask for a schema if you need OpenAPI generation.";
    }
  } catch {
    return "JSON is invalid — fix parse errors first.";
  }
  return "Ask to explain, schema, or typescript.";
}
