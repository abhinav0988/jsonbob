/** Get value at JSONPath-ish `$` / `.key` / `[i]` path used by the tree/diff. */
export function getAtPath(root: unknown, path: string): unknown {
  if (!path || path === "$") return root;
  const parts = tokenizePath(path);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      const i = Number(part);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
    } else {
      cur = (cur as Record<string, unknown>)[part];
    }
  }
  return cur;
}

/** Replace value at path; returns a deep-cloned updated root. */
export function setAtPath(root: unknown, path: string, value: unknown): unknown {
  if (!path || path === "$") return value;
  const parts = tokenizePath(path);
  const clone = structuredClone(root) as unknown;
  let cur: unknown = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cur == null || typeof cur !== "object") return root;
    if (Array.isArray(cur)) cur = cur[Number(part)];
    else cur = (cur as Record<string, unknown>)[part];
  }
  const last = parts[parts.length - 1]!;
  if (cur == null || typeof cur !== "object") return root;
  if (Array.isArray(cur)) cur[Number(last)] = value;
  else (cur as Record<string, unknown>)[last] = value;
  return clone;
}

export function tokenizePath(path: string): string[] {
  const raw = path.startsWith("$") ? path.slice(1) : path;
  const parts: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === ".") {
      i++;
      let key = "";
      while (i < raw.length && raw[i] !== "." && raw[i] !== "[") {
        key += raw[i];
        i++;
      }
      if (key) parts.push(key);
    } else if (raw[i] === "[") {
      i++;
      if (raw[i] === '"') {
        i++;
        let key = "";
        while (i < raw.length && raw[i] !== '"') {
          if (raw[i] === "\\") {
            i++;
            key += raw[i] ?? "";
          } else key += raw[i];
          i++;
        }
        i++; // closing "
        if (raw[i] === "]") i++;
        parts.push(key);
      } else {
        let num = "";
        while (i < raw.length && raw[i] !== "]") {
          num += raw[i];
          i++;
        }
        if (raw[i] === "]") i++;
        parts.push(num);
      }
    } else {
      i++;
    }
  }
  return parts;
}

export function pathToLabel(path: string): string {
  if (!path || path === "$") return "$";
  return path.startsWith("$.") ? path.slice(2) : path.replace(/^\$/, "");
}

/** Find arrays-of-objects nested under `root` (for table mode hints). */
export function findTableCandidates(
  value: unknown,
  path = "$",
  out: Array<{ path: string; length: number }> = [],
  depth = 0,
): Array<{ path: string; length: number }> {
  if (depth > 8) return out;
  if (Array.isArray(value)) {
    const objects = value.filter((v) => v && typeof v === "object" && !Array.isArray(v));
    if (objects.length > 0 && objects.length === value.length) {
      out.push({ path, length: value.length });
    }
    value.forEach((item, i) => findTableCandidates(item, `${path}[${i}]`, out, depth + 1));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const child = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)
        ? path === "$"
          ? `$.${k}`
          : `${path}.${k}`
        : `${path}[${JSON.stringify(k)}]`;
      findTableCandidates(v, child, out, depth + 1);
    }
  }
  return out;
}

export function isFlatObjectArray(value: unknown): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((row) => row && typeof row === "object" && !Array.isArray(row));
}

/** Columns for a flat array-of-objects table (skips nested object/array cells as preview). */
export function tableColumns(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) keys.add(k);
  }
  return [...keys];
}

export function cellPreview(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      return s.length > 40 ? `${s.slice(0, 39)}…` : s;
    } catch {
      return String(value);
    }
  }
  return String(value);
}
