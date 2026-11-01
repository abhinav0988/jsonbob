import fs from "node:fs";
import path from "node:path";

export type CaseStatus = "PASS" | "FAIL" | "SKIP";

export type CaseResult = {
  feature: string;
  caseId: string;
  title: string;
  status: CaseStatus;
  detail?: string;
  durationMs?: number;
};

export class FeatureReport {
  private results: CaseResult[] = [];
  private startedAt = new Date();

  async check(
    feature: string,
    caseId: string,
    title: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const t0 = Date.now();
    try {
      await fn();
      this.results.push({
        feature,
        caseId,
        title,
        status: "PASS",
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      this.results.push({
        feature,
        caseId,
        title,
        status: "FAIL",
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      });
    }
  }

  skip(feature: string, caseId: string, title: string, reason: string) {
    this.results.push({ feature, caseId, title, status: "SKIP", detail: reason });
  }

  getResults() {
    return [...this.results];
  }

  writeMarkdown(outPath: string, meta: { baseURL: string }) {
    const byFeature = new Map<string, CaseResult[]>();
    for (const r of this.results) {
      if (!byFeature.has(r.feature)) byFeature.set(r.feature, []);
      byFeature.get(r.feature)!.push(r);
    }

    const pass = this.results.filter((r) => r.status === "PASS").length;
    const fail = this.results.filter((r) => r.status === "FAIL").length;
    const skip = this.results.filter((r) => r.status === "SKIP").length;
    const total = this.results.length;

    const lines: string[] = [
      "# jsonbob — QA Feature Validation Report",
      "",
      `**Generated:** ${new Date().toISOString()}`,
      `**Target:** ${meta.baseURL}`,
      `**Duration:** ${Math.round((Date.now() - this.startedAt.getTime()) / 1000)}s`,
      "",
      "## Summary",
      "",
      "| Metric | Count |",
      "|--------|------:|",
      `| Total checks | ${total} |`,
      `| Passed | ${pass} |`,
      `| Failed | ${fail} |`,
      `| Skipped | ${skip} |`,
      `| **Pass rate** | **${total ? Math.round((pass / total) * 100) : 0}%** |`,
      "",
      "## By feature",
      "",
      "| Feature | Pass | Fail | Skip | Status |",
      "|---------|-----:|-----:|-----:|--------|",
    ];

    for (const [feature, cases] of byFeature) {
      const p = cases.filter((c) => c.status === "PASS").length;
      const f = cases.filter((c) => c.status === "FAIL").length;
      const s = cases.filter((c) => c.status === "SKIP").length;
      const status = f === 0 ? "✅ OK" : "❌ ISSUES";
      lines.push(`| ${feature} | ${p} | ${f} | ${s} | ${status} |`);
    }

    lines.push("", "---", "");

    for (const [feature, cases] of byFeature) {
      lines.push(`## ${feature}`, "");
      lines.push("| ID | Test case | Result | Notes |");
      lines.push("|----|-----------|--------|-------|");
      for (const c of cases) {
        const icon = c.status === "PASS" ? "✅" : c.status === "FAIL" ? "❌" : "⏭";
        const note = c.detail ? c.detail.replace(/\|/g, "\\|").slice(0, 120) : "";
        lines.push(`| ${c.caseId} | ${c.title} | ${icon} ${c.status} | ${note} |`);
      }
      lines.push("");
    }

    if (fail > 0) {
      lines.push("## Failed cases (action required)", "");
      for (const c of this.results.filter((r) => r.status === "FAIL")) {
        lines.push(`- **${c.feature} / ${c.caseId}** — ${c.title}`);
        if (c.detail) lines.push(`  - ${c.detail}`);
      }
      lines.push("");
    }

    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    console.log(`\n📄 Feature report written: ${outPath}`);
    console.log(`   PASS ${pass} / FAIL ${fail} / SKIP ${skip}\n`);
  }
}

/** Random test data helpers */
export const testData = {
  email: () => `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@jsonbob.test`,
  password: {
    valid: "TestPass123!",
    short: "abc",
    weak: "1234567",
  },
  json: {
    valid: () => JSON.stringify({ id: Math.random(), name: "QA", items: [1, 2, 3], ok: true }),
    validPretty: '{\n  "hello": "world",\n  "n": 42\n}',
    invalid: ["{not-json", '{"a":}', "{]", "undefined", '{"x": NaN}'],
    reorderA: '{"b":2,"a":1}',
    reorderB: '{"a":1,"b":2}',
    identical: '{"same":true}',
  },
  randomSearch: () => `zzz_${Math.random().toString(36).slice(2, 12)}`,
};
