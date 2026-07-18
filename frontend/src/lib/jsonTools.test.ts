import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveApiBaseUrl, PROD_API_FALLBACK } from "./apiBase.ts";
import { collectJsonPaths } from "./collectJsonPaths.ts";
import { compareJson, summarizeDiffs } from "./jsonDiff.ts";
import { getAtPath, setAtPath, tokenizePath } from "./jsonPath.ts";
import { validateAgainstSchema, type SchemaIssue } from "./jsonSchemaValidate.ts";

describe("collectJsonPaths", () => {
  it("walks nested objects", () => {
    const paths = collectJsonPaths({ a: { b: 1 }, c: [true] }, 50);
    assert.ok(paths.includes("$"));
    assert.ok(paths.includes("$.a"));
    assert.ok(paths.includes("$.a.b"));
    assert.ok(paths.includes("$.c[0]"));
  });
});

describe("jsonSchemaValidate", () => {
  it("enforces required + format email", () => {
    const issues = validateAgainstSchema(
      { email: "nope" },
      {
        type: "object",
        required: ["email", "name"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string" },
        },
      },
    );
    assert.ok(issues.some((i: SchemaIssue) => i.message.includes("required")));
    assert.ok(issues.some((i: SchemaIssue) => i.message.includes("email")));
  });

  it("supports exclusiveMinimum and uniqueItems", () => {
    const issues = validateAgainstSchema([1, 1], {
      type: "array",
      uniqueItems: true,
      items: { type: "number", exclusiveMinimum: 0 },
    });
    assert.ok(issues.some((i: SchemaIssue) => i.message.includes("unique")));
  });
});

describe("resolveApiBaseUrl", () => {
  it("uses env URL and strips trailing slash", () => {
    assert.equal(resolveApiBaseUrl("https://api.example.com/", false), "https://api.example.com");
  });

  it("falls back in production when env empty", () => {
    assert.equal(resolveApiBaseUrl("", true), PROD_API_FALLBACK);
    assert.equal(resolveApiBaseUrl(undefined, true), PROD_API_FALLBACK);
  });

  it("returns empty in development when env missing", () => {
    assert.equal(resolveApiBaseUrl(null, false), "");
    assert.equal(resolveApiBaseUrl("   ", false), "");
  });
});

describe("jsonPath", () => {
  it("tokenizes and get/set nested paths", () => {
    assert.deepEqual(tokenizePath("$.a.b[0]"), ["a", "b", "0"]);
    const root = { a: { b: [1, 2] } };
    assert.equal(getAtPath(root, "$.a.b[1]"), 2);
    const next = setAtPath(root, "$.a.b[1]", 9) as { a: { b: number[] } };
    assert.equal(next.a.b[1], 9);
    assert.equal(root.a.b[1], 2);
  });
});

describe("jsonDiff", () => {
  it("detects value changes and summarizes", () => {
    const diffs = compareJson({ a: 1, b: true }, { a: 2, b: true });
    assert.ok(diffs.some((d) => d.kind === "value_changed" && d.path.includes("a")));
    const summary = summarizeDiffs(diffs);
    assert.ok(summary.total >= 1);
  });
});
