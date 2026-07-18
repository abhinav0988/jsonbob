/** RFC 6902 JSON Patch + RFC 7396 Merge Patch (document body helpers). */

import { getAtPath, setAtPath, tokenizePath } from "./jsonPath";

export type JsonPatchOp = {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  from?: string;
  value?: unknown;
};

function pointerToDollar(pointer: string): string {
  if (!pointer || pointer === "/") return "$";
  const parts = pointer
    .split("/")
    .slice(1)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let out = "$";
  for (const part of parts) {
    if (/^\d+$/.test(part)) out += `[${part}]`;
    else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) out += `.${part}`;
    else out += `[${JSON.stringify(part)}]`;
  }
  return out;
}

function parentAndKey(path: string): { parent: string; key: string } | null {
  const parts = tokenizePath(path);
  if (parts.length === 0) return null;
  const key = parts[parts.length - 1]!;
  if (parts.length === 1) return { parent: "$", key };
  let parent = "$";
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    parent = /^\d+$/.test(p)
      ? `${parent}[${p}]`
      : /^[A-Za-z_][A-Za-z0-9_]*$/.test(p)
        ? `${parent}.${p}`
        : `${parent}[${JSON.stringify(p)}]`;
  }
  return { parent, key };
}

function removeAt(root: unknown, path: string): unknown {
  const pk = parentAndKey(path);
  if (!pk) throw new Error("Cannot remove root");
  const parent = structuredClone(getAtPath(root, pk.parent));
  if (Array.isArray(parent)) {
    const idx = Number(pk.key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new Error(`remove: invalid index ${pk.key}`);
    }
    parent.splice(idx, 1);
    return setAtPath(root, pk.parent, parent);
  }
  if (parent && typeof parent === "object") {
    delete (parent as Record<string, unknown>)[pk.key];
    return setAtPath(root, pk.parent, parent);
  }
  throw new Error(`remove: parent not found at ${pk.parent}`);
}

function addAt(root: unknown, path: string, value: unknown): unknown {
  if (path === "$" || path === "") return value;
  const pk = parentAndKey(path);
  if (!pk) return value;
  const parent = getAtPath(root, pk.parent);
  if (Array.isArray(parent)) {
    const next = structuredClone(parent) as unknown[];
    if (pk.key === "-") next.push(value);
    else {
      const idx = Number(pk.key);
      if (!Number.isInteger(idx) || idx < 0 || idx > next.length) {
        throw new Error(`add: invalid index ${pk.key}`);
      }
      next.splice(idx, 0, value);
    }
    return setAtPath(root, pk.parent, next);
  }
  if (parent && typeof parent === "object") {
    const next = { ...(parent as Record<string, unknown>), [pk.key]: value };
    return setAtPath(root, pk.parent, next);
  }
  throw new Error(`add: parent not found at ${pk.parent}`);
}

export function applyJsonPatch(doc: unknown, patch: JsonPatchOp[]): unknown {
  let cur = structuredClone(doc);
  for (const op of patch) {
    const path = pointerToDollar(op.path);
    switch (op.op) {
      case "test": {
        const found = getAtPath(cur, path);
        if (JSON.stringify(found) !== JSON.stringify(op.value)) {
          throw new Error(`test failed at ${op.path}`);
        }
        break;
      }
      case "remove":
        cur = removeAt(cur, path);
        break;
      case "add":
        cur = addAt(cur, path, op.value);
        break;
      case "replace":
        cur = setAtPath(cur, path, op.value);
        break;
      case "move": {
        if (!op.from) throw new Error("move requires from");
        const from = pointerToDollar(op.from);
        const val = getAtPath(cur, from);
        if (val === undefined) throw new Error(`move: missing ${op.from}`);
        cur = removeAt(cur, from);
        cur = addAt(cur, path, val);
        break;
      }
      case "copy": {
        if (!op.from) throw new Error("copy requires from");
        const from = pointerToDollar(op.from);
        const val = structuredClone(getAtPath(cur, from));
        if (val === undefined) throw new Error(`copy: missing ${op.from}`);
        cur = addAt(cur, path, val);
        break;
      }
      default:
        throw new Error(`Unsupported op`);
    }
  }
  return cur;
}

/** RFC 7396 JSON Merge Patch */
export function applyMergePatch(target: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch;
  }
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    target = {};
  }
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === null) delete out[k];
    else out[k] = applyMergePatch(out[k], v);
  }
  return out;
}

export function parsePatchDocument(text: string): JsonPatchOp[] {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error("JSON Patch must be an array of operations");
  return parsed as JsonPatchOp[];
}
