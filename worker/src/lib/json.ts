/** Strip JSON pollution keys recursively. */
export function sanitizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeJson);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      out[key] = sanitizeJson(val);
    }
    return out;
  }
  return value;
}

export function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
