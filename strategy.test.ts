import { describe, it, expect } from "vitest";
import { planBuyFromAllocBps } from "./strategy.js";

describe("planBuyFromAllocBps", () => {
  it("skips when below min alloc", () => {
    const res = planBuyFromAllocBps(10, 1, { minAllocBps: 25, maxSlippageBps: 250, baseSol: 0.01, maxSol: 0.2, curveK: 8 }, 0.25);
    expect(res.kind).toBe("skip");
  });

  it("buys and clamps to claimable", () => {
    const res = planBuyFromAllocBps(500, 0.02, { minAllocBps: 25, maxSlippageBps: 250, baseSol: 0.01, maxSol: 0.2, curveK: 8 }, 0.25);
    expect(res.kind).toBe("buy");
    if (res.kind === "buy") expect(res.solAmount).toBeLessThanOrEqual(0.02);
  });
});
