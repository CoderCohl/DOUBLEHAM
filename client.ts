import { z } from "zod";
import type { Launch, Fees, Holder, MarketQuote, BuyResult, MintAddress, FeeSplit } from "./types.js";

export type BagsClientOptions = {
  baseUrl: string;
  userAgent?: string;
  timeoutMs?: number;
};

const launchSchema = z.object({
  mint: z.string(),
  symbol: z.string().default(""),
  name: z.string().default(""),
  createdAt: z.number(),
  creator: z.string().optional(),
});

const feesSchema = z.object({
  claimableSol: z.number(),
  lastUpdated: z.number(),
});

const holderSchema = z.object({
  owner: z.string(),
  amount: z.string(),
  pct: z.number(),
});

const feeRecipientSchema = z.object({
  wallet: z.string(),
  bps: z.number().int(),
});

const feeSplitSchema = z.object({
  mint: z.string(),
  recipients: z.array(feeRecipientSchema),
});

const quoteSchema = z.object({
  mint: z.string(),
  priceSolPerToken: z.number(),
  liquidityScore: z.number().optional(),
});

export interface BagsClient {
  listNewLaunches(sinceMs: number, limit: number): Promise<Launch[]>;
  getClaimableFees(wallet: string): Promise<Fees>;
  getHolders(mint: MintAddress, limit: number): Promise<Holder[]>;
  getQuote(mint: MintAddress): Promise<MarketQuote>;
  getFeeSplit(mint: MintAddress): Promise<FeeSplit>;
  buyWithSol(params: {
    mint: MintAddress;
    solAmount: number;
    slippageBps: number;
    payerPubkey: string;
  }): Promise<BuyResult>;
  claimFees(params: { wallet: string }): Promise<{ claimedSol: number }>;
}

/**
 * HTTP client that talks to a Bags API.
 *
 * IMPORTANT:
 * This repository includes a working, production-grade client shape,
 * but it does not hardcode undocumented endpoints.
 *
 * You must map these methods to the actual Bags API routes you use.
 * See README "API Adapter" section.
 */
export class HttpBagsClient implements BagsClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeoutMs: number;

  constructor(opts: BagsClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.headers = {
      "accept": "application/json",
      "user-agent": opts.userAgent ?? "bags-chaos-bot/0.1",
    };
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  private async getJson<T>(path: string, schema: z.ZodTypeAny): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: this.headers,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Bags API ${res.status} ${res.statusText} on GET ${path}`);
      const json = await res.json();
      return schema.parse(json) as T;
    } finally {
      clearTimeout(t);
    }
  }

  private async postJson<T>(path: string, body: unknown, schema: z.ZodTypeAny): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { ...this.headers, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Bags API ${res.status} ${res.statusText} on POST ${path}`);
      const json = await res.json();
      return schema.parse(json) as T;
    } finally {
      clearTimeout(t);
    }
  }

  async listNewLaunches(sinceMs: number, limit: number): Promise<Launch[]> {
    // TODO: map to Bags route
    // Example:
    // return this.getJson(`/launches?since=${sinceMs}&limit=${limit}`, z.array(launchSchema));
    return this.getJson(`/launches?since=${sinceMs}&limit=${limit}`, z.array(launchSchema));
  }

  async getClaimableFees(wallet: string): Promise<Fees> {
    // TODO: map to Bags route
    return this.getJson(`/wallets/${wallet}/fees`, feesSchema);
  }

  async claimFees(params: { wallet: string }): Promise<{ claimedSol: number }> {
    // TODO: map to Bags route
    return this.postJson(`/wallets/${params.wallet}/fees/claim`, {}, z.object({ claimedSol: z.number() }));
  }

  async getHolders(mint: MintAddress, limit: number): Promise<Holder[]> {
    // TODO: map to Bags route
    return this.getJson(`/tokens/${mint}/holders?limit=${limit}`, z.array(holderSchema));
  }

  async getQuote(mint: MintAddress): Promise<MarketQuote> {
    // TODO: map to Bags route
    return this.getJson(`/tokens/${mint}/quote`, quoteSchema);
  }

async getFeeSplit(mint: MintAddress): Promise<FeeSplit> {
  // TODO: map to Bags route
  return this.getJson(`/tokens/${mint}/feesplit`, feeSplitSchema);
}

  async buyWithSol(params: {
    mint: MintAddress;
    solAmount: number;
    slippageBps: number;
    payerPubkey: string;
  }): Promise<BuyResult> {
    // TODO: map to Bags route
    return this.postJson(
      `/tokens/${params.mint}/buy`,
      {
        solAmount: params.solAmount,
        slippageBps: params.slippageBps,
        payer: params.payerPubkey,
      },
      z.object({ signature: z.string() })
    );
  }
}
