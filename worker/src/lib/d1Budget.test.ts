import { describe, expect, it } from "vitest";
import { d1BudgetRetryAfterSec, isD1BudgetExemptPath, resolveLimits } from "./d1Budget";

describe("d1Budget", () => {
  it("defaults to a 2M hard / 1.5M soft cap", () => {
    expect(resolveLimits({})).toEqual({ hardLimit: 2_000_000, softLimit: 1_500_000 });
  });

  it("exempts health and docs only", () => {
    expect(isD1BudgetExemptPath("/health")).toBe(true);
    expect(isD1BudgetExemptPath("/ready")).toBe(true);
    expect(isD1BudgetExemptPath("/documents")).toBe(false);
  });

  it("retry-after points at remaining UTC day", () => {
    expect(d1BudgetRetryAfterSec(Date.parse("2026-11-01T12:00:00.000Z"))).toBe(12 * 60 * 60);
  });
});
