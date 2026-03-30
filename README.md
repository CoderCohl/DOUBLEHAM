<div align="center">
  <img src="chaos.png" alt="BagsChaosBot" width="220" />
</div>

# BagsChaosBot

A fee-funded, opt-in chaos agent for Bags.

This project is a reference implementation of a "Mayhem style" automated participant that:

- Uses a public, doxxed wallet
- Claims protocol fees attributable to that wallet
- Recycles claimed fees back into eligible launches through automated buys
- Applies explicit safety gates to avoid reinforcing unhealthy holder concentration
- Leaves an auditable trail of actions in a local database

The design goal is simple: **if a project opts into chaos by routing a portion of its fees to the bot wallet, the bot converts that fee stream into automated market participation.**

## What this is not

- Not profit sharing
- Not a yield product
- Not a promise to support every launch
- Not a guarantee of price impact
- Not an attempt to hide behavior

This is infrastructure. It is intentionally mechanical.

## High level model

Projects on Bags can route a portion of protocol fees to arbitrary recipients.

If a project includes the chaos wallet as a recipient:

- The chaos wallet accrues claimable fees over time
- The bot periodically claims those fees
- The bot uses the claimed SOL as a bounded budget to place buys on new launches that opted in
- The bot may abstain if distribution is too concentrated

In other words, the bot is a fee-funded volatility recycler.

## Repository layout

```
.
├─ src/
│  ├─ bags/                 # Bags API client + type contracts
│  ├─ engine.ts             # Main polling and execution loop
│  ├─ strategy.ts           # Buy sizing logic from fee allocation
│  ├─ risk.ts               # Holder distribution gates
│  ├─ db.ts                 # SQLite persistence
│  └─ cli.ts                # Entry point
├─ .env.example
├─ package.json
└─ tsconfig.json
```

## Requirements

- Node.js 18+
- A Bags API endpoint you can query
- A Solana RPC endpoint (used for confirmation in some deployments)
- A doxxed chaos wallet public key
- A local keypair for signing (keep private key out of git)

This repo intentionally avoids hardcoding undocumented Bags endpoints. The HTTP client is production shaped, but you must map the paths to the actual Bags routes you are using.

## Configuration

Copy `.env.example` to `.env` and fill in values.

Key parameters:

- `BAGS_API_BASE_URL`  
  Base URL for the Bags API.

- `CHAOS_WALLET_PUBKEY`  
  Public wallet address for the bot. This wallet should be doxxed publicly.

- `POLL_INTERVAL_MS`  
  How often the bot checks for new launches.

- `MIN_SOL_BALANCE`  
  Minimum claimable fee threshold before attempting actions.

- `MAX_SOL_PER_BUY`  
  Absolute cap per buy. This exists to prevent runaway execution.

- `ALLOWLIST` and `DENYLIST`  
  Optional comma separated mint address lists.

## Running

Install:

```bash
npm install
```

Development run:

```bash
npm run dev
```

Build and run:

```bash
npm run build
npm start
```

Logs are JSON by default. If you want human readable logs:

```bash
npm run dev | npx pino-pretty
```

## Core concepts

### 1) Eligibility: opt-in fee split

The bot does not buy every coin. It only considers coins that explicitly opted in by including the chaos wallet as a fee recipient.

The bot queries a fee split document for each new mint:

```ts
type FeeRecipient = { wallet: string; bps: number };
type FeeSplit = { mint: string; recipients: FeeRecipient[] };
```

If `bps` for the chaos wallet is zero, the mint is ignored.

### 2) Budget: claim and recycle

The bot treats claimable fees as a global budget.

At the start of each tick:

1. Fetch claimable fees for the chaos wallet
2. If below `MIN_SOL_BALANCE`, do nothing
3. Claim fees
4. Use the claimed amount as `budgetSol` for the tick
5. Spend the budget across eligible mints, bounded by `MAX_SOL_PER_BUY`

This is an explicit anti-extraction posture. If the bot receives more fees, it can be more active. If it receives no fees, it cannot do anything.

### 3) Aggression: fee allocation -> execution curve

Each mint can allocate different bps to the chaos wallet.

Higher bps should translate into more aggressive market participation, but should not scale linearly forever. A logistic curve is used:

- Sensitive at low to mid allocations
- Saturates as allocation becomes large
- Always clamped to safety limits

Implementation:

```ts
const x = Math.min(1, allocBps / 1000);
const logistic = 1 / (1 + Math.exp(-curveK * (x - 0.5)));
const sol = baseSol + logistic * (maxSol - baseSol);
const bounded = Math.min(sol, maxSolPerBuy, claimableSol);
```

This turns "I routed 0.5%" into a meaningful difference vs "I routed 0.05%", while preventing 10% allocations from forcing absurd buy sizes.

### 4) Risk: holder distribution gates

The bot can optionally abstain if holder distribution is unhealthy.

This repo implements a minimal, explicit gate:

- `top1` share
- `top5` share
- HHI (Herfindahl-Hirschman Index)

Definitions:

- `topN = sum(pct_i for i in top N holders)`
- `HHI = sum(pct_i^2 for all holders)`

Example thresholds (defaults in `engine.ts`):

- `top1 <= 0.12`
- `top5 <= 0.35`
- `hhi <= 0.10`

These values are conservative and should be tuned to the Bags environment.

Why this exists:

- If the earliest holders already control most of supply, buying into that is more likely to amplify a single wallet outcome than to create a distributed market.
- The bot is meant to be opt-in chaos, not a concentration multiplier.

### 5) Ordering: newest first

When multiple launches are discovered in a tick, the bot processes newest first.

Rationale:

- Chaos is intended to create early activity
- Older launches already have organic distribution dynamics
- The fee-funded budget is finite, so spend it where it matches intent

## Engine behavior

The engine uses a polling loop:

1. Load `last_seen_ms` from SQLite
2. Query new launches since last seen
3. Update `last_seen_ms` to the newest `createdAt`
4. Claim fees (if threshold met)
5. For each launch:
   - Check allow/deny list
   - Fetch fee split
   - Skip if chaos wallet not present
   - Fetch holders
   - Skip if risk gate fails
   - Plan buy size from allocation
   - Fetch quote
   - Buy with SOL
   - Persist action result to SQLite

Actions are stored for audit:

```sql
CREATE TABLE actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  mint TEXT NOT NULL,
  action TEXT NOT NULL,
  amount_sol REAL NOT NULL,
  reason TEXT NOT NULL,
  tx_sig TEXT
);
```

This gives you a durable, queryable timeline of what happened and why.

## API adapter contract

This repo includes an HTTP client with the correct shape, but you must map it to real Bags endpoints.

Interface:

```ts
export interface BagsClient {
  listNewLaunches(sinceMs: number, limit: number): Promise<Launch[]>;
  getClaimableFees(wallet: string): Promise<Fees>;
  claimFees(params: { wallet: string }): Promise<{ claimedSol: number }>;
  getFeeSplit(mint: string): Promise<FeeSplit>;
  getHolders(mint: string, limit: number): Promise<Holder[]>;
  getQuote(mint: string): Promise<MarketQuote>;
  buyWithSol(params: {
    mint: string;
    solAmount: number;
    slippageBps: number;
    payerPubkey: string;
  }): Promise<{ signature: string }>;
}
```

If Bags requires transaction signing, you typically have one of these patterns:

### Pattern A: API returns a transaction to sign

- Client requests a buy
- API responds with a base64 serialized transaction
- Bot signs with its keypair
- Bot sends the transaction via Solana RPC
- Bot returns signature

### Pattern B: API submits on behalf of the wallet

- API holds custody or a session for the wallet
- Bot authenticates to API
- API submits transactions

This repo defaults to Pattern B in the interface for simplicity, but you can implement Pattern A by extending `buyWithSol` to return `transactionBase64` instead of `signature`, then adding a signer module.

## Observability

Minimal observability is included:

- Structured logs via `pino`
- Persistent action records in SQLite

Suggested production additions:

- Export Prometheus counters: buys attempted, buys succeeded, skips by reason
- Add a "dry run" mode that logs plans without executing buys
- Add a heartbeat endpoint for deployment health checks

## Safety and controls

You should treat this as an agent that can spend SOL.

Recommended controls:

- Keep `MAX_SOL_PER_BUY` low until you validate behavior
- Set `MIN_SOL_BALANCE` to avoid constant micro-spam actions
- Add a global daily spend cap (not implemented here)
- Add a per-mint cooldown window (not implemented here)
- Use allowlist mode for initial testing

## Threat model and abuse cases

This section is explicit because chaos bots attract adversarial thinking.

### Abuse: spoofed fee splits

If an attacker can forge fee split data through the API, they can trick the bot into buying.

Mitigation:

- Only trust fee split data from authoritative, signed sources
- Prefer on-chain derived fee split state if possible
- Add allowlist mode for production

### Abuse: holder list manipulation

If holder data is incomplete or stale, risk gates can be bypassed.

Mitigation:

- Fetch holders from a reliable indexer
- Validate that holder percentages sum to a reasonable total
- Increase holder sample size
- Add additional gates based on liquidity or trading volume

### Abuse: quote spoofing

If quote is incorrect, buy sizing can become unsafe.

Mitigation:

- Validate quote ranges
- Add a max price impact gate
- Cross-check with a second quote source if available

## Development notes

### Tests

`vitest` is included with small unit tests for:

- Risk calculations
- Buy planning curve

Run:

```bash
npm test
```

### Database

SQLite is used intentionally:

- Local, no infra required
- Durable state across restarts
- Easy to inspect with any SQLite browser

## Operational playbook

Suggested rollout:

1. Run in allowlist mode on a small set of test mints
2. Set low caps: `MAX_SOL_PER_BUY=0.02`, `MIN_SOL_BALANCE=0.05`
3. Verify fee claiming works and budget equals expected SOL
4. Observe action table for correctness
5. Increase caps slowly
6. Remove allowlist once behavior is stable

## License

MIT. See `LICENSE`.

## Disclaimer

This repository is provided for educational and experimental purposes.

Automated trading agents can lose funds. You are responsible for any deployment, configuration, and compliance obligations.
