
md
<div align="center">
  <img src="doubleham.png" alt="DOUBLEHAM" width="220" />
</div>

# DOUBLEHAM

A double-layer mayhem engine for pump.fun.

This project is a reference implementation of a "Mayhem style" automated participant that:

- Uses a public, doxxed wallet
- Executes randomized and reactive buy behavior
- Amplifies market activity through layered feedback loops
- Optionally recycles fees into additional chaos
- Leaves an auditable trail of all actions

The design goal is simple:

**create visible, continuous, and reactive on-chain activity that feeds itself**

---

## What this is not

- Not a profit strategy
- Not optimized trading
- Not a yield system
- Not predictable
- Not designed to be efficient

This is an engine for chaos.

---

## What is DOUBLE MAYHEM

Mayhem is not just buying.

It is:
- irregular activity
- unpredictable timing
- bursts of volume
- visible interaction with the chart

DOUBLEHAM adds a second layer.

It does not just create chaos.

It reacts to its own chaos and amplifies it.

---

## High level model

The system runs two interacting loops:

1. Base Mayhem Loop  
2. Amplification Loop  

```txt
activity → attention → volume → triggers → more activity
                     ↑
              amplification layer
````

This creates a recursive system.

---

## Repository layout

```
.
├─ src/
│  ├─ engine.ts             # Main loop controller
│  ├─ mayhem.ts             # Base randomized execution
│  ├─ amplify.ts            # Reactive burst logic
│  ├─ strategy.ts           # Buy sizing + randomness
│  ├─ risk.ts               # Optional safety gates
│  ├─ db.ts                 # SQLite persistence
│  └─ cli.ts                # Entry point
├─ .env.example
├─ package.json
└─ tsconfig.json
```

---

## Core concepts

### 1) Base Mayhem Loop

This creates constant background activity.

Behavior:

* random time intervals
* random buy sizes
* optional multi-wallet execution

```ts
while (active) {
  await sleep(random(minDelay, maxDelay))
  const size = random(minBuy, maxBuy)
  executeBuy(size)
}
```

This ensures the chart never feels idle.

---

### 2) Amplification Loop (Double Layer)

This is what makes DOUBLEHAM.

The system watches for signals:

* buy spikes
* sudden volume changes
* inactivity gaps
* external buys

When triggered:

```ts
if (spikeDetected) {
  executeBurst(nBuys, variableSizes)
}

if (inactivityDetected) {
  injectNoise()
}
```

The system reacts, not just schedules.

---

### 3) Budget Model (optional)

If connected to a fee wallet:

* claim fees
* treat as execution budget
* recycle into buys

```txt
fees → buys → activity → more fees → more buys
```

If no fees exist, the system can still run with a fixed budget.

---

### 4) Buy Sizing

Buy sizes are not fixed.

They are:

* randomized within bounds
* optionally scaled by activity level
* capped for safety

Example:

```ts
const base = random(minBuy, maxBuy)
const multiplier = activityLevel()
const size = Math.min(base * multiplier, maxBuyCap)
```

---

### 5) Double Mayhem Behavior

Normal bots:

* linear
* predictable
* time-based

DOUBLEHAM:

* layered
* reactive
* feedback-driven

```txt
Layer 1 → constant noise
Layer 2 → reactive bursts
```

Result:

* continuous movement
* perceived momentum
* unpredictable chart behavior

---

### 6) Optional Risk Gates

The system can abstain if conditions are unhealthy.

Examples:

* high holder concentration
* low liquidity
* abnormal price impact

This is configurable and optional.

---

## Engine behavior

Each cycle:

1. Check balance or claim fees
2. Run base mayhem loop
3. Scan for triggers
4. Execute amplification bursts
5. Log all actions

Actions are stored:

```sql
CREATE TABLE actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  action TEXT NOT NULL,
  amount_sol REAL NOT NULL,
  reason TEXT NOT NULL,
  tx_sig TEXT
);
```

Everything is auditable.

---

## Configuration

```
MIN_BUY=0.01
MAX_BUY=0.2
MIN_DELAY=5
MAX_DELAY=45
BURST_COUNT=5
BURST_MULTIPLIER=2
INACTIVITY_THRESHOLD=60
MAX_SOL_PER_BUY=0.25
```

---

## Running

Install:

```bash
npm install
```

Run:

```bash
npm run dev
```

---

## Observability

Included:

* structured logs
* SQLite action history

Recommended:

* metrics dashboard
* dry-run mode
* trigger visibility

---

## Design principles

Inspectable
All logic is visible and modular.

Understandable
No hidden behavior.

Extendable
New triggers and strategies can be added easily.

---

## Why it works

Markets react to activity.

Not logic.

DOUBLEHAM creates:

* visible movement
* constant interaction
* perceived urgency

It exploits:

* attention
* momentum perception
* behavioral reactions

---

## Threat model

This system is intentionally chaotic.

Risks include:

* overbuying
* poor timing
* amplification of bad conditions

Mitigation:

* strict caps
* cooldowns
* optional gates

---

## Roadmap

* multi-wallet swarm mode
* adaptive burst intelligence
* on-chain trigger signals
* UI dashboard
* cross-token routing

---

## TLDR

DOUBLEHAM creates chaos.

Then reacts to it.

Then doubles it.

---

## Disclaimer

This repository is experimental.

Automated systems can lose funds.

You are responsible for all deployment and usage.

```

---
