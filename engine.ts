import type { BagsClient } from "./bags/client.js";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { computeConcentration, passesRisk } from "./risk.js";
import { getAllocBpsForWallet, planBuyFromAllocBps } from "./strategy.js";

export type EngineDeps = {
  cfg: Config;
  db: Db;
  client: BagsClient;
  log: { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void; debug: (...a: any[]) => void };
};

const KV_LAST_SEEN = "last_seen_ms";

export class ChaosEngine {
  private deps: EngineDeps;
  private running = false;

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  async start() {
    this.running = true;
    const { cfg, db, log } = this.deps;

    log.info({ wallet: cfg.CHAOS_WALLET_PUBKEY }, "ChaosEngine starting");

    const lastSeen = Number(db.kvGet(KV_LAST_SEEN) ?? Date.now() - 60_000);
    db.kvSet(KV_LAST_SEEN, String(lastSeen));

    while (this.running) {
      try {
        await this.tick();
      } catch (e: any) {
        log.error({ err: String(e?.message ?? e) }, "tick error");
      }
      await new Promise((r) => setTimeout(r, cfg.POLL_INTERVAL_MS));
    }
  }

  stop() {
    this.running = false;
  }

  private eligibleMint(mint: string): boolean {
    const { cfg } = this.deps;
    if (cfg.denylist?.has(mint)) return false;
    if (cfg.allowlist && !cfg.allowlist.has(mint)) return false;
    return true;
  }

  private async tick() {
    const { cfg, db, client, log } = this.deps;

    const since = Number(db.kvGet(KV_LAST_SEEN) ?? Date.now() - 60_000);
    const launches = await client.listNewLaunches(since, 25);

    const newest = launches.reduce((m, l) => Math.max(m, l.createdAt), since);
    db.kvSet(KV_LAST_SEEN, String(newest));

    if (!launches.length) {
      log.debug({ since }, "no launches");
      return;
    }

    // Fees are a global budget. We claim then spend.
    const fees = await client.getClaimableFees(cfg.CHAOS_WALLET_PUBKEY);
    if (fees.claimableSol < cfg.MIN_SOL_BALANCE) {
      log.debug({ claimableSol: fees.claimableSol }, "below MIN_SOL_BALANCE, skipping");
      return;
    }

    // Claim first to make budget available.
    const claimRes = await client.claimFees({ wallet: cfg.CHAOS_WALLET_PUBKEY });
    log.info({ claimedSol: claimRes.claimedSol }, "claimed fees");

    // Re-fetch for accurate post-claim number if the API exposes it, otherwise assume claimRes.
    const budgetSol = Math.max(0, claimRes.claimedSol);

    // Strategy defaults
    const stratCfg = {
      minAllocBps: 25,
      maxSlippageBps: 250,
      baseSol: 0.01,
      maxSol: 0.2,
      curveK: 8,
    } as const;

    const riskCfg = {
      maxTop1: 0.12,
      maxTop5: 0.35,
      maxHhi: 0.10,
    } as const;

    let remaining = budgetSol;

    // Process newest first
    const sorted = [...launches].sort((a, b) => b.createdAt - a.createdAt);

    for (const launch of sorted) {
      if (!this.eligibleMint(launch.mint)) continue;
      if (remaining <= 0) break;

      // Check if token opted in to Chaos
      const split = await client.getFeeSplit(launch.mint);
      const allocBps = getAllocBpsForWallet(split, cfg.CHAOS_WALLET_PUBKEY);
      if (allocBps <= 0) {
        log.debug({ mint: launch.mint }, "no alloc for chaos wallet");
        continue;
      }

      // Holder distribution gate
      const holders = await client.getHolders(launch.mint, 50);
      const conc = computeConcentration(holders);
      const risk = passesRisk(conc, riskCfg);

      if (!risk.ok) {
        log.info({ mint: launch.mint, allocBps, conc, reason: risk.reason }, "skip: risk gate");
        db.insertAction.run({
          ts: Date.now(),
          mint: launch.mint,
          action: "SKIP",
          amount_sol: 0,
          reason: `risk:${risk.reason}`,
          tx_sig: null,
        });
        continue;
      }

      const plan = planBuyFromAllocBps(allocBps, remaining, stratCfg, cfg.MAX_SOL_PER_BUY);
      if (plan.kind === "skip") {
        log.debug({ mint: launch.mint, allocBps, reason: plan.reason }, "skip: plan");
        continue;
      }

      // Optional: quote check to avoid absurd pricing
      const quote = await client.getQuote(launch.mint);
      if (!Number.isFinite(quote.priceSolPerToken) || quote.priceSolPerToken <= 0) {
        log.info({ mint: launch.mint }, "skip: invalid quote");
        continue;
      }

      // Execute buy
      log.info({ mint: launch.mint, sol: plan.solAmount, slippageBps: plan.slippageBps, allocBps }, "buy");

      const res = await client.buyWithSol({
        mint: launch.mint,
        solAmount: plan.solAmount,
        slippageBps: plan.slippageBps,
        payerPubkey: cfg.CHAOS_WALLET_PUBKEY,
      });

      remaining -= plan.solAmount;

      db.insertAction.run({
        ts: Date.now(),
        mint: launch.mint,
        action: "BUY",
        amount_sol: plan.solAmount,
        reason: plan.reason,
        tx_sig: res.signature,
      });
    }

    log.info({ budgetSol, remaining, launches: launches.length }, "tick complete");
  }
}
