export type DiffKind =
  | "missing_in_a"
  | "missing_in_b"
  | "value_changed"
  | "type_changed"
  | "array_length"
  | "moved";

export interface JsonDiffItem {
  path: string;
  kind: DiffKind;
  leftType?: string;
  rightType?: string;
  leftValue?: unknown;
  rightValue?: unknown;
  message: string;
}

export type CompareOptions = {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
  ignoreKeyOrder?: boolean;
};

function valueType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function preview(v: unknown, max = 48): string {
  try {
    const s = JSON.stringify(v);
    if (s.length <= max) return s;
    return `${s.slice(0, max - 1)}…`;
  } catch {
    return String(v);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizePrimitive(v: unknown, opts: CompareOptions): unknown {
  if (typeof v !== "string") return v;
  let s = v;
  if (opts.ignoreWhitespace) s = s.replace(/\s+/g, " ").trim();
  if (opts.ignoreCase) s = s.toLowerCase();
  return s;
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (isObject(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

function prepare(v: unknown, opts: CompareOptions): unknown {
  const walk = (x: unknown): unknown => {
    if (typeof x === "string") return normalizePrimitive(x, opts);
    if (Array.isArray(x)) return x.map(walk);
    if (isObject(x)) {
      const out: Record<string, unknown> = {};
      const keys = opts.ignoreKeyOrder ? Object.keys(x).sort() : Object.keys(x);
      for (const k of keys) out[k] = walk(x[k]);
      return out;
    }
    return x;
  };
  let next = walk(v);
  if (opts.ignoreKeyOrder) next = sortKeysDeep(next);
  return next;
}

/** Deep compare two JSON values. Paths use JSONPath-ish `$` / `.key` / `[i]`. */
export function compareJson(
  a: unknown,
  b: unknown,
  basePath = "$",
  opts: CompareOptions = {},
): JsonDiffItem[] {
  const diffs: JsonDiffItem[] = [];
  walk(prepare(a, opts), prepare(b, opts), basePath, diffs);
  return diffs;
}

function walk(a: unknown, b: unknown, path: string, out: JsonDiffItem[]) {
  const ta = valueType(a);
  const tb = valueType(b);

  if (ta !== tb) {
    out.push({
      path,
      kind: "type_changed",
      leftType: ta,
      rightType: tb,
      leftValue: a,
      rightValue: b,
      message: `Type differs: ${ta} → ${tb}`,
    });
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push({
        path,
        kind: "array_length",
        leftType: "array",
        rightType: "array",
        leftValue: a.length,
        rightValue: b.length,
        message: `Array length differs: ${a.length} → ${b.length}`,
      });
    }
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const child = `${path}[${i}]`;
      if (i >= a.length) {
        out.push({
          path: child,
          kind: "missing_in_a",
          rightType: valueType(b[i]),
          rightValue: b[i],
          message: `Key/index missing in A: ${child}`,
        });
      } else if (i >= b.length) {
        out.push({
          path: child,
          kind: "missing_in_b",
          leftType: valueType(a[i]),
          leftValue: a[i],
          message: `Key/index missing in B: ${child}`,
        });
      } else {
        walk(a[i], b[i], child, out);
      }
    }
    return;
  }

  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of [...keys].sort()) {
      const child = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`;
      const inA = Object.prototype.hasOwnProperty.call(a, key);
      const inB = Object.prototype.hasOwnProperty.call(b, key);
      if (!inA) {
        out.push({
          path: child,
          kind: "missing_in_a",
          rightType: valueType(b[key]),
          rightValue: b[key],
          message: `Key missing in A: ${key}`,
        });
      } else if (!inB) {
        out.push({
          path: child,
          kind: "missing_in_b",
          leftType: valueType(a[key]),
          leftValue: a[key],
          message: `Key missing in B: ${key}`,
        });
      } else {
        walk(a[key], b[key], child, out);
      }
    }
    return;
  }

  if (!Object.is(a, b) && JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({
      path,
      kind: "value_changed",
      leftType: ta,
      rightType: tb,
      leftValue: a,
      rightValue: b,
      message: `Value changed: ${preview(a)} → ${preview(b)}`,
    });
  }
}

export function summarizeDiffs(diffs: JsonDiffItem[]) {
  return {
    total: diffs.length,
    missingInA: diffs.filter((d) => d.kind === "missing_in_a").length,
    missingInB: diffs.filter((d) => d.kind === "missing_in_b").length,
    valueChanged: diffs.filter((d) => d.kind === "value_changed").length,
    typeChanged: diffs.filter((d) => d.kind === "type_changed").length,
    arrayLength: diffs.filter((d) => d.kind === "array_length").length,
    moved: diffs.filter((d) => d.kind === "moved").length,
  };
}

export function kindLabel(kind: DiffKind): string {
  switch (kind) {
    case "missing_in_a":
      return "Missing in A";
    case "missing_in_b":
      return "Missing in B";
    case "value_changed":
      return "Value changed";
    case "type_changed":
      return "Type changed";
    case "array_length":
      return "Array length";
    case "moved":
      return "Moved";
  }
}

export function kindColor(kind: DiffKind): string {
  switch (kind) {
    case "missing_in_a":
      return "text-sky-300";
    case "missing_in_b":
      return "text-amber-300";
    case "value_changed":
      return "text-rose-300";
    case "type_changed":
      return "text-violet-300";
    case "array_length":
      return "text-orange-300";
    case "moved":
      return "text-emerald-300";
  }
}
