import { z } from "zod";
import "dotenv/config";
import path from "node:path";

const envSchema = z.object({
  BAGS_API_BASE_URL: z.string().url(),
  CHAOS_WALLET_PUBKEY: z.string().min(20),
  SOLANA_KEYPAIR_PATH: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  POLL_INTERVAL_MS: z.coerce.number().int().min(250),
  MAX_SOL_PER_BUY: z.coerce.number().positive(),
  MIN_SOL_BALANCE: z.coerce.number().nonnegative(),
  ALLOWLIST: z.string().optional().default(""),
  DENYLIST: z.string().optional().default(""),
  DB_PATH: z.string().optional().default("./data/chaos.sqlite"),
  LOG_LEVEL: z.string().optional().default("info"),
});

export type Config = z.infer<typeof envSchema> & {
  allowlist: Set<string> | null;
  denylist: Set<string> | null;
};

export function loadConfig(): Config {
  const parsed = envSchema.parse(process.env);

  const splitList = (v: string): Set<string> | null => {
    const trimmed = (v ?? "").trim();
    if (!trimmed) return null;
    return new Set(trimmed.split(",").map((s) => s.trim()).filter(Boolean));
  };

  const cfg: Config = {
    ...parsed,
    DB_PATH: path.normalize(parsed.DB_PATH),
    allowlist: splitList(parsed.ALLOWLIST ?? ""),
    denylist: splitList(parsed.DENYLIST ?? ""),
  };

  return cfg;
}
