import { describe, expect, it } from "vitest";
import { sanitizeJson, byteSize } from "./json";

describe("sanitizeJson", () => {
  it("strips prototype pollution keys", () => {
    const input = JSON.parse('{"a":1,"__proto__":{"x":1},"constructor":"nope"}');
    const out = sanitizeJson(input) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out).not.toHaveProperty("__proto__");
    expect(out).not.toHaveProperty("constructor");
  });

  it("computes byte size", () => {
    expect(byteSize({ a: 1 })).toBeGreaterThan(0);
  });
});
