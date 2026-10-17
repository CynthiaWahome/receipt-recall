import Database from "better-sqlite3";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

let db: Database.Database | null = null;

// Schema is inlined (not read from disk) so it survives production bundling,
// where a relative file path like `src/lib/schema.sql` is not present in the
// server output. The canonical reference copy lives in src/lib/schema.sql —
// keep the two in sync when the schema changes.
const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  image_path TEXT,
  sha256 TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('processing','review','confirmed','failed')),
  store TEXT,
  purchased_on TEXT,
  currency TEXT NOT NULL DEFAULT 'KES',
  total_minor INTEGER,
  raw_ocr TEXT,
  draft_json TEXT,
  error_code TEXT,
  mismatch_acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  base_unit TEXT NOT NULL CHECK(base_unit IN ('ml','g','each')),
  pack_size_base REAL NOT NULL CHECK(pack_size_base > 0),
  low_stock_threshold REAL NOT NULL DEFAULT 0 CHECK(low_stock_threshold >= 0)
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  raw_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  line_total_minor INTEGER NOT NULL CHECK(line_total_minor >= 0),
  source_line_ids TEXT NOT NULL,
  UNIQUE(receipt_id, id)
);

CREATE TABLE IF NOT EXISTS receipt_adjustments (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(id),
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL REFERENCES products(id),
  receipt_item_id TEXT UNIQUE REFERENCES receipt_items(id),
  kind TEXT NOT NULL CHECK(kind IN ('purchase','used','wasted','count')),
  quantity REAL NOT NULL CHECK(quantity >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  label TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1 CHECK(quantity > 0),
  checked INTEGER NOT NULL DEFAULT 0 CHECK(checked IN (0,1))
);

CREATE INDEX IF NOT EXISTS items_product ON receipt_items(product_id);
CREATE INDEX IF NOT EXISTS movements_product_sequence ON stock_movements(product_id, sequence);
CREATE INDEX IF NOT EXISTS receipts_date ON receipts(purchased_on);
`;

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

  db.exec(SCHEMA);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
