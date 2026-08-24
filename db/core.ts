import { env } from "cloudflare:workers";

type AppEnvironment = {
  DB?: D1Database;
  SUPERVISOR_PASSWORD_HASH?: string;
};

export function appEnv() {
  return env as unknown as AppEnvironment;
}

export function database() {
  const db = appEnv().DB;
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function ensureDatabase() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS months (
      month_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_key TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      task_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewer TEXT,
      FOREIGN KEY (month_key) REFERENCES months(month_key)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS tasks_month_date_idx ON tasks(month_key, task_date DESC, id DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS supervisor_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
  return db;
}

export function monthKeyForRiyadh() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function monthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(new Date(`${monthKey}-01T12:00:00Z`));
}

export function isMonthKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isDateKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(value);
}
