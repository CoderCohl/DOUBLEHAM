import pino from "pino";

export function createLogger(level: string) {
  // Keep logger dependency minimal and deterministic for headless runs.
  // If you want pretty logs locally, pipe through `pino-pretty`:
  //   npm run dev | pino-pretty
  return pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
