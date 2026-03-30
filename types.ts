export type MintAddress = string;

export type Launch = {
  mint: MintAddress;
  symbol: string;
  name: string;
  createdAt: number; // unix ms
  creator?: string;
};

export type Holder = {
  owner: string;
  amount: string; // raw token units as string to avoid float
  pct: number; // 0..1
};

export type Fees = {
  claimableSol: number;
  lastUpdated: number; // unix ms
};

export type MarketQuote = {
  mint: MintAddress;
  priceSolPerToken: number;
  liquidityScore?: number;
};

export type FeeRecipient = {
  wallet: string;
  bps: number; // 1% = 100 bps
};

export type FeeSplit = {
  mint: MintAddress;
  recipients: FeeRecipient[];
};

export type BuyResult = {
  signature: string;
};
