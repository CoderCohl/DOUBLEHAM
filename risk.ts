import type { Holder } from "./bags/types.js";

export type ConcentrationReport = {
  top1: number;
  top5: number;
  top10: number;
  hhi: number; // Herfindahl-Hirschman Index using pct shares
};

/**
 * Simple holder distribution signals.
 * pct is expected as 0..1.
 */
export function computeConcentration(holders: Holder[]): ConcentrationReport {
  const sorted = [...holders].sort((a, b) => b.pct - a.pct);
  const top = (n: number) => sorted.slice(0, n).reduce((s, h) => s + h.pct, 0);

  const hhi = sorted.reduce((s, h) => s + h.pct * h.pct, 0);

  return {
    top1: top(1),
    top5: top(5),
    top10: top(10),
    hhi,
  };
}

export type RiskDecision =
  | { ok: true; reason: string }
  | { ok: false; reason: string };

export type RiskConfig = {
  maxTop1: number;  // e.g. 0.12
  maxTop5: number;  // e.g. 0.35
  maxHhi: number;   // e.g. 0.10
};

export function passesRisk(report: ConcentrationReport, cfg: RiskConfig): RiskDecision {
  if (report.top1 > cfg.maxTop1) return { ok: false, reason: `top1 ${report.top1.toFixed(4)} > ${cfg.maxTop1}` };
  if (report.top5 > cfg.maxTop5) return { ok: false, reason: `top5 ${report.top5.toFixed(4)} > ${cfg.maxTop5}` };
  if (report.hhi > cfg.maxHhi) return { ok: false, reason: `hhi ${report.hhi.toFixed(4)} > ${cfg.maxHhi}` };
  return { ok: true, reason: "distribution ok" };
}
