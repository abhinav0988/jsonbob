/** Extra converters: XML, TOML, SQL INSERT, OpenAPI stub. */

export function jsonToXml(value: unknown, rootName = "root"): string {
  function esc(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function safeTag(name: string) {
    const n = name.replace(/[^A-Za-z0-9_.-]/g, "_");
    return /^[A-Za-z_]/.test(n) ? n : `n_${n}`;
  }
  function node(name: string, v: unknown, indent: number): string {
    const pad = "  ".repeat(indent);
    const tag = safeTag(name);
    if (v === null || v === undefined) return `${pad}<${tag} nil="true"/>`;
    if (typeof v === "boolean" || typeof v === "number") return `${pad}<${tag}>${v}</${tag}>`;
    if (typeof v === "string") return `${pad}<${tag}>${esc(v)}</${tag}>`;
    if (Array.isArray(v)) {
      if (v.length === 0) return `${pad}<${tag}/>`;
      return v.map((item) => node(tag === rootName ? "item" : tag, item, indent)).join("\n");
    }
    if (typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      if (entries.length === 0) return `${pad}<${tag}/>`;
      const inner = entries.map(([k, child]) => node(k, child, indent + 1)).join("\n");
      return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
    }
    return `${pad}<${tag}>${esc(String(v))}</${tag}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${node(rootName, value, 0)}\n`;
}

/** Very small XML → JSON (element text / nested elements / repeated tags → arrays). */
export function xmlToJson(xml: string): unknown {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error("Invalid XML");
  function walk(el: Element): unknown {
    const kids = [...el.children];
    if (kids.length === 0) {
      const t = el.textContent?.trim() ?? "";
      if (t === "") return null;
      if (t === "true") return true;
      if (t === "false") return false;
      if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
      return t;
    }
    const out: Record<string, unknown> = {};
    for (const child of kids) {
      const key = child.tagName;
      const val = walk(child);
      if (key in out) {
        const prev = out[key];
        out[key] = Array.isArray(prev) ? [...prev, val] : [prev, val];
      } else out[key] = val;
    }
    return out;
  }
  const root = doc.documentElement;
  return { [root.tagName]: walk(root) };
}

export function jsonToToml(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("TOML export needs a root object");
  }
  const lines: string[] = [];
  function escStr(s: string) {
    return JSON.stringify(s);
  }
  function writeTable(prefix: string, obj: Record<string, unknown>) {
    const scalars: Array<[string, unknown]> = [];
    const tables: Array<[string, Record<string, unknown>]> = [];
    const arraysOfTables: Array<[string, Record<string, unknown>[]]> = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        tables.push([k, v as Record<string, unknown>]);
      } else if (
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((i) => i && typeof i === "object" && !Array.isArray(i))
      ) {
        arraysOfTables.push([k, v as Record<string, unknown>[]]);
      } else {
        scalars.push([k, v]);
      }
    }
    if (prefix) lines.push(`\n[${prefix}]`);
    for (const [k, v] of scalars) {
      if (typeof v === "string") lines.push(`${k} = ${escStr(v)}`);
      else if (typeof v === "number" || typeof v === "boolean") lines.push(`${k} = ${v}`);
      else if (v === null) lines.push(`${k} = ""`);
      else if (Array.isArray(v)) lines.push(`${k} = ${JSON.stringify(v)}`);
      else lines.push(`${k} = ${escStr(JSON.stringify(v))}`);
    }
    for (const [k, t] of tables) {
      writeTable(prefix ? `${prefix}.${k}` : k, t);
    }
    for (const [k, arr] of arraysOfTables) {
      for (const item of arr) {
        lines.push(`\n[[${prefix ? `${prefix}.${k}` : k}]]`);
        for (const [ik, iv] of Object.entries(item)) {
          if (iv !== null && typeof iv === "object") continue;
          if (typeof iv === "string") lines.push(`${ik} = ${escStr(iv)}`);
          else lines.push(`${ik} = ${iv}`);
        }
      }
    }
  }
  writeTable("", value as Record<string, unknown>);
  return `${lines.join("\n").trim()}\n`;
}

/** Minimal TOML → JSON for flat/simple nested tables. */
export function tomlToJson(text: string): unknown {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const table = line.match(/^\[([^\]]+)\]$/);
    const aot = line.match(/^\[\[([^\]]+)\]\]$/);
    if (aot) {
      const path = aot[1]!.split(".");
      let cur: Record<string, unknown> = root;
      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i]!;
        if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
      const key = path[path.length - 1]!;
      if (!Array.isArray(cur[key])) cur[key] = [];
      const obj: Record<string, unknown> = {};
      (cur[key] as unknown[]).push(obj);
      current = obj;
      continue;
    }
    if (table) {
      const path = table[1]!.split(".");
      let cur: Record<string, unknown> = root;
      for (const p of path) {
        if (!cur[p] || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {};
        cur = cur[p] as Record<string, unknown>;
      }
      current = cur;
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    let parsed: unknown = val;
    if (val === "true") parsed = true;
    else if (val === "false") parsed = false;
    else if (/^-?\d+(\.\d+)?$/.test(val)) parsed = Number(val);
    else if (val.startsWith('"') || val.startsWith("'") || val.startsWith("[")) {
      try {
        parsed = JSON.parse(val.replace(/^'/, '"').replace(/'$/, '"'));
      } catch {
        parsed = val.replace(/^["']|["']$/g, "");
      }
    }
    current[key] = parsed;
  }
  return root;
}

export function jsonToSqlInsert(value: unknown, table = "data"): string {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("SQL export needs a non-empty array of objects");
  }
  if (!value.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
    throw new Error("SQL export needs an array of objects");
  }
  const rows = value as Record<string, unknown>[];
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  return rows
    .map(
      (r) =>
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => esc(r[c])).join(", ")});`,
    )
    .join("\n");
}

export function jsonToOpenApiStub(value: unknown, title = "Generated"): string {
  function schemaOf(v: unknown): Record<string, unknown> {
    if (v === null) return { nullable: true };
    if (Array.isArray(v)) {
      return { type: "array", items: v.length ? schemaOf(v[0]) : {} };
    }
    if (typeof v === "object") {
      const props: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        props[k] = schemaOf(child);
      }
      return { type: "object", properties: props };
    }
    if (typeof v === "number") return { type: Number.isInteger(v) ? "integer" : "number" };
    if (typeof v === "boolean") return { type: "boolean" };
    return { type: "string" };
  }
  const doc = {
    openapi: "3.0.3",
    info: { title, version: "1.0.0" },
    paths: {
      "/example": {
        get: {
          summary: "Example resource shaped like the current JSON",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: schemaOf(value),
                  example: value,
                },
              },
            },
          },
        },
      },
    },
  };
  return JSON.stringify(doc, null, 2);
}
