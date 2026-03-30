import { describe, it, expect } from "vitest";
import { computeConcentration, passesRisk } from "./risk.js";

describe("risk", () => {
  it("computes top holders", () => {
    const holders = [
      { owner: "a", amount: "1", pct: 0.2 },
      { owner: "b", amount: "1", pct: 0.1 },
      { owner: "c", amount: "1", pct: 0.05 },
    ];
    const r = computeConcentration(holders as any);
    expect(r.top1).toBeCloseTo(0.2);
    expect(r.top5).toBeCloseTo(0.35);
  });

  it("fails when too concentrated", () => {
    const r = { top1: 0.5, top5: 0.7, top10: 0.7, hhi: 0.3 };
    const d = passesRisk(r as any, { maxTop1: 0.12, maxTop5: 0.35, maxHhi: 0.10 });
    expect(d.ok).toBe(false);
  });
});
