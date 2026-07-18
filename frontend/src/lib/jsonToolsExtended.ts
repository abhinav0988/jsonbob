/** Extended JSON / string tools for the toolbox + palette. */

import { parseSchemaText, validateAgainstSchema } from "./jsonSchemaValidate";

export function flattenJson(
  value: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    out[prefix || "$"] = value;
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) out[prefix || "$"] = [];
    value.forEach((item, i) => {
      const key = prefix ? `${prefix}[${i}]` : `$[${i}]`;
      flattenJson(item, key, out);
    });
    return out;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) out[prefix || "$"] = {};
  for (const [k, v] of entries) {
    const key = prefix ? `${prefix}.${k}` : k;
    flattenJson(v, key, out);
  }
  return out;
}

export function unflattenJson(flat: Record<string, unknown>): unknown {
  const root: Record<string, unknown> = {};
  for (const [path, val] of Object.entries(flat)) {
    const parts = path.replace(/\$\[/g, "[").replace(/^\$\.?/, "").split(/(?:\.|\[|\]\.?)/).filter(Boolean);
    let cur: Record<string, unknown> | unknown[] = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const last = i === parts.length - 1;
      const nextIsIndex = parts[i + 1] !== undefined && /^\d+$/.test(parts[i + 1]!);
      if (last) {
        if (Array.isArray(cur)) (cur as unknown[])[Number(part)] = val;
        else (cur as Record<string, unknown>)[part] = val;
      } else {
        if (Array.isArray(cur)) {
          const idx = Number(part);
          if ((cur as unknown[])[idx] == null) (cur as unknown[])[idx] = nextIsIndex ? [] : {};
          cur = (cur as unknown[])[idx] as Record<string, unknown> | unknown[];
        } else {
          const obj = cur as Record<string, unknown>;
          if (obj[part] == null) obj[part] = nextIsIndex ? [] : {};
          cur = obj[part] as Record<string, unknown> | unknown[];
        }
      }
    }
  }
  return root;
}

export function jsonToCsv(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("CSV export needs a non-empty array of objects");
  }
  if (!value.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
    throw new Error("CSV export needs an array of flat objects");
  }
  const rows = value as Record<string, unknown>[];
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function csvToJson(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

export function mapKeysDeep(value: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeysDeep(v, fn));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[fn(k)] = mapKeysDeep(v, fn);
    }
    return out;
  }
  return value;
}

export function toSnake(k: string) {
  return k
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function toCamel(k: string) {
  return k
    .replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c) => c.toLowerCase());
}

export function toPascal(k: string) {
  const c = toCamel(k);
  return c ? c[0]!.toUpperCase() + c.slice(1) : c;
}

export function base64Encode(text: string) {
  return btoa(unescape(encodeURIComponent(text)));
}

export function base64Decode(text: string) {
  return decodeURIComponent(escape(atob(text.trim())));
}

export function decodeJwt(token: string): { header: unknown; payload: unknown } {
  const parts = token.trim().split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  const dec = (p: string) => {
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  };
  return { header: dec(parts[0]!), payload: dec(parts[1]!) };
}

export function urlEncode(text: string) {
  return encodeURIComponent(text);
}

export function urlDecode(text: string) {
  return decodeURIComponent(text);
}

export function escapeJsonString(text: string) {
  return JSON.stringify(text).slice(1, -1);
}

export function unescapeJsonString(text: string) {
  return JSON.parse(`"${text}"`) as string;
}

export function sortArraysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map(sortArraysDeep);
    const allPrim = mapped.every((v) => v === null || typeof v !== "object");
    if (allPrim) {
      return [...mapped].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return mapped;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sortArraysDeep(v);
    }
    return out;
  }
  return value;
}

export function generateUuidsInPlace(value: unknown, keyMatch = /uuid|id$/i): unknown {
  if (Array.isArray(value)) return value.map((v) => generateUuidsInPlace(v, keyMatch));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string" && keyMatch.test(k) && (v === "" || v === "GENERATE")) {
        out[k] = crypto.randomUUID();
      } else out[k] = generateUuidsInPlace(v, keyMatch);
    }
    return out;
  }
  return value;
}

export type JsonProblem = {
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
  line?: number;
  column?: number;
};

export function analyzeProblems(text: string, schemaText?: string | null): JsonProblem[] {
  const problems: JsonProblem[] = [];
  if (!text.trim()) {
    problems.push({ severity: "info", message: "Document is empty", line: 1, column: 1 });
    return problems;
  }
  try {
    JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    const pos = message.match(/position\s+(\d+)/i);
    let line = 1;
    let column = 1;
    if (pos) {
      const index = Number(pos[1]);
      const before = text.slice(0, index);
      line = before.split("\n").length;
      column = before.length - before.lastIndexOf("\n");
    }
    problems.push({ severity: "error", message, line, column });
    return problems;
  }
  try {
    const data = JSON.parse(text) as unknown;
    const size = new TextEncoder().encode(text).length;
    if (size > 5_000_000) {
      problems.push({
        severity: "warning",
        message: `Large document (${(size / 1e6).toFixed(1)} MB)`,
      });
    }
    walkWarn(data, "$", problems, 0);

    if (schemaText?.trim()) {
      const parsedSchema = parseSchemaText(schemaText);
      if (!parsedSchema.ok) {
        problems.push({
          severity: "error",
          message: `Schema: ${parsedSchema.error}`,
        });
      } else {
        const issues = validateAgainstSchema(data, parsedSchema.schema);
        if (issues.length === 0) {
          problems.push({
            severity: "info",
            message: "Valid against attached JSON Schema",
          });
        } else {
          for (const issue of issues.slice(0, 200)) {
            problems.push({
              severity: "error",
              message: `Schema: ${issue.message}`,
              path: issue.path,
            });
          }
          if (issues.length > 200) {
            problems.push({
              severity: "warning",
              message: `…and ${issues.length - 200} more schema issues`,
            });
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return problems;
}

function walkWarn(value: unknown, path: string, out: JsonProblem[], depth: number) {
  if (depth > 40) {
    out.push({ severity: "warning", message: "Deep nesting (>40)", path });
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) {
      out.push({ severity: "warning", message: `Large array (${value.length} items)`, path });
    }
    value.forEach((v, i) => walkWarn(v, `${path}[${i}]`, out, depth + 1));
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value as object);
    if (keys.length > 5_000) {
      out.push({ severity: "warning", message: `Object with ${keys.length} keys`, path });
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`;
      walkWarn(v, child, out, depth + 1);
    }
  }
}
