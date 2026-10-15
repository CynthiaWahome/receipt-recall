import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

let db: Database.Database | null = null;

function getDataDir(): string {
  return process.env.DATA_DIR ?? "./data";
}

function getDbPath(): string {
  return resolve(getDataDir(), "receipts.sqlite");
}

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  ensureDataDir();
  db = new Database(getDbPath());

  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}