/** Collect JSONPath-like keys for command-palette node search (capped). */
export function collectJsonPaths(value: unknown, max = 400): string[] {
  const out: string[] = [];

  function walk(node: unknown, path: string) {
    if (out.length >= max) return;
    out.push(path);
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (out.length >= max) return;
        walk(node[i], `${path}[${i}]`);
      }
      return;
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (out.length >= max) return;
      const next = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
        ? `${path}.${key}`
        : `${path}[${JSON.stringify(key)}]`;
      walk((node as Record<string, unknown>)[key], next);
    }
  }

  walk(value, "$");
  return out;
}
