import Database from "better-sqlite3";

export type Db = ReturnType<typeof openDb>;

export function openDb(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      mint TEXT NOT NULL,
      action TEXT NOT NULL,
      amount_sol REAL NOT NULL,
      reason TEXT NOT NULL,
      tx_sig TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_actions_ts ON actions(ts);
    CREATE INDEX IF NOT EXISTS idx_actions_mint ON actions(mint);
  `);

  const getStmt = db.prepare("SELECT value FROM kv WHERE key = ?");
  const setStmt = db.prepare(
    "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  );

  const kvGet = (key: string): string | null => {
    const row = getStmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  };

  const kvSet = (key: string, value: string) => setStmt.run(key, value);

  const insertAction = db.prepare(`
    INSERT INTO actions(ts, mint, action, amount_sol, reason, tx_sig)
    VALUES(@ts, @mint, @action, @amount_sol, @reason, @tx_sig)
  `);

  return {
    raw: db,
    kvGet,
    kvSet,
    insertAction,
  };
}
