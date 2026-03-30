import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { createLogger } from "./logger.js";
import { HttpBagsClient } from "./bags/client.js";
import { ChaosEngine } from "./engine.js";
import fs from "node:fs";

function ensureDir(p: string) {
  const dir = p.split("/").slice(0, -1).join("/") || ".";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const cfg = loadConfig();
  const log = createLogger(cfg.LOG_LEVEL);

  ensureDir(cfg.DB_PATH);
  const db = openDb(cfg.DB_PATH);

  const client = new HttpBagsClient({
    baseUrl: cfg.BAGS_API_BASE_URL,
    userAgent: "bags-chaos-bot/0.1",
  });

  const engine = new ChaosEngine({ cfg, db, client, log });

  process.on("SIGINT", () => {
    log.info("SIGINT received, shutting down");
    engine.stop();
  });
  process.on("SIGTERM", () => {
    log.info("SIGTERM received, shutting down");
    engine.stop();
  });

  await engine.start();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
