import type { FeeSplit } from "./bags/types.js";

export type ExecutionPlan =
  | { kind: "skip"; reason: string }
  | { kind: "buy"; solAmount: number; slippageBps: number; reason: string };

export type StrategyConfig = {
  // The bot uses its own claimable SOL, then cycles it back into buys.
  // These parameters translate "fee allocation" into aggressiveness.

  // Minimum fee allocation (bps) to be eligible at all.
  minAllocBps: number; // ex: 25 = 0.25%

  // Upper bound for slippage
  maxSlippageBps: number; // ex: 250 = 2.5%

  // Buy sizing curve parameters
  baseSol: number;      // baseline SOL per buy when alloc is minimal
  maxSol: number;       // cap per buy
  curveK: number;       // curve steepness
};

export function getAllocBpsForWallet(split: FeeSplit, wallet: string): number {
  const r = split.recipients.find((x) => x.wallet === wallet);
  return r?.bps ?? 0;
}

/**
 * Convert an allocation bps into a buy size.
 * Uses a squashed logistic curve so increases are meaningful early,
 * but asymptotically approach maxSol.
 */
export function planBuyFromAllocBps(
  allocBps: number,
  claimableSol: number,
  cfg: StrategyConfig,
  maxSolPerBuy: number
): ExecutionPlan {
  if (allocBps < cfg.minAllocBps) return { kind: "skip", reason: `alloc ${allocBps} bps < min ${cfg.minAllocBps}` };
  if (claimableSol <= 0) return { kind: "skip", reason: "no claimable fees" };

  // Normalize alloc to 0..1 range for curve input.
  // 1000 bps = 10% (a typical upper bound in many fee-split designs).
  const x = Math.min(1, allocBps / 1000);

  const logistic = 1 / (1 + Math.exp(-cfg.curveK * (x - 0.5)));
  const sol = cfg.baseSol + logistic * (cfg.maxSol - cfg.baseSol);

  // Safety clamps
  const bounded = Math.min(sol, maxSolPerBuy, claimableSol);

  // Slippage grows with alloc, but bounded.
  const slip = Math.round(Math.min(cfg.maxSlippageBps, 50 + x * cfg.maxSlippageBps));

  if (bounded <= 0) return { kind: "skip", reason: "bounded sol <= 0" };

  return {
    kind: "buy",
    solAmount: bounded,
    slippageBps: slip,
    reason: `alloc=${allocBps}bps x=${x.toFixed(3)} buy=${bounded.toFixed(4)} slip=${slip}bps`,
  };
}
