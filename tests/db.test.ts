import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, closeDb } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { reconcile } from "@/lib/calculations";

interface ReceiptRow {
  id: string;
  status: string;
  store: string | null;
  purchased_on: string | null;
  currency: string;
  total_minor: number | null;
  raw_ocr: string | null;
  draft_json: string | null;
  error_code: string | null;
  mismatch_acknowledged: number;
  created_at: string;
  confirmed_at: string | null;
}

interface ItemRow {
  id: string;
  receipt_id: string;
  product_id: string;
  raw_name: string;
  quantity: number;
  line_total_minor: number;
  source_line_ids: string;
}

interface MovementRow {
  id: string;
  product_id: string;
  receipt_item_id: string;
  kind: string;
  quantity: number;
  created_at: string;
}

describe("Database operations", () => {
  beforeEach(() => {
    closeDb();
    process.env.DATA_DIR = "./data/test";
  });

  afterEach(() => {
    closeDb();
  });

  it("initializes schema", () => {
    const db = getDb();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("receipts");
    expect(names).toContain("products");
    expect(names).toContain("receipt_items");
    expect(names).toContain("receipt_adjustments");
    expect(names).toContain("stock_movements");
    expect(names).toContain("shopping_items");
  });

  it("creates and confirms receipt atomically", () => {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO receipts (id, status, store, purchased_on, currency, total_minor, created_at)
      VALUES (?, 'review', ?, ?, ?, ?, ?)
    `).run(id, "Test Store", "2026-01-15", "KES", 38500, now);

    const tx = db.transaction(() => {
      const itemId = randomUUID();
      const productId = randomUUID();

      db.prepare(`
        INSERT INTO products (id, name, brand, category, base_unit, pack_size_base, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(productId, "Test Product", "Test Brand", "test", "each", 1);

      db.prepare(`
        INSERT INTO receipt_items (id, receipt_id, product_id, raw_name, quantity, line_total_minor, source_line_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, id, productId, "Test Product", 2, 26000, JSON.stringify(["L1"]));

      const movementId = randomUUID();
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, receipt_item_id, kind, quantity, created_at)
        VALUES (?, ?, ?, 'purchase', ?, ?)
      `).run(movementId, productId, itemId, 2, now);

      db.prepare(`
        UPDATE receipts SET status = 'confirmed', confirmed_at = ? WHERE id = ?
      `).run(now, id);
    });

    tx();

    const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as ReceiptRow | undefined;
    expect(receipt?.status).toBe("confirmed");

    const items = db.prepare("SELECT * FROM receipt_items WHERE receipt_id = ?").all(id) as ItemRow[];
    expect(items).toHaveLength(1);
    expect(items[0].line_total_minor).toBe(26000);

    const movements = db.prepare("SELECT * FROM stock_movements WHERE receipt_item_id = ?").all(items[0].id) as MovementRow[];
    expect(movements).toHaveLength(1);
    expect(movements[0].kind).toBe("purchase");
    expect(movements[0].quantity).toBe(2);
  });

  it("rolls back on failure", () => {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO receipts (id, status, store, purchased_on, currency, total_minor, created_at)
      VALUES (?, 'review', ?, ?, ?, ?, ?)
    `).run(id, "Test Store", "2026-01-15", "KES", 38500, now);

    const tx = db.transaction(() => {
      const itemId = randomUUID();
      const productId = randomUUID();

      db.prepare(`
        INSERT INTO products (id, name, brand, category, base_unit, pack_size_base, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(productId, "Test Product", "Test Brand", "test", "each", 1);

      db.prepare(`
        INSERT INTO receipt_items (id, receipt_id, product_id, raw_name, quantity, line_total_minor, source_line_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, id, productId, "Test Product", 2, 26000, JSON.stringify(["L1"]));

      throw new Error("Simulated failure");
    });

    expect(() => tx()).toThrow("Simulated failure");

    const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as ReceiptRow | undefined;
    expect(receipt?.status).toBe("review");

    const items = db.prepare("SELECT * FROM receipt_items WHERE receipt_id = ?").all(id) as ItemRow[];
    expect(items).toHaveLength(0);
  });

  it("duplicate confirm with same receipt_item_id adds no second purchase", () => {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO receipts (id, status, store, purchased_on, currency, total_minor, created_at)
      VALUES (?, 'review', ?, ?, ?, ?, ?)
    `).run(id, "Test Store", "2026-01-15", "KES", 38500, now);

    const productId = randomUUID();
    const itemId = randomUUID();
    db.prepare(`
      INSERT INTO products (id, name, brand, category, base_unit, pack_size_base, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(productId, "Test Product", "Test Brand", "test", "each", 1);

    const tx1 = db.transaction(() => {
      db.prepare(`
        INSERT INTO receipt_items (id, receipt_id, product_id, raw_name, quantity, line_total_minor, source_line_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, id, productId, "Test Product", 2, 26000, JSON.stringify(["L1"]));

      const movementId = randomUUID();
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, receipt_item_id, kind, quantity, created_at)
        VALUES (?, ?, ?, 'purchase', ?, ?)
      `).run(movementId, productId, itemId, 2, now);

      db.prepare(`
        UPDATE receipts SET status = 'confirmed', confirmed_at = ? WHERE id = ?
      `).run(now, id);
    });
    tx1();

    const tx2 = db.transaction(() => {
      const movementId = randomUUID();
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, receipt_item_id, kind, quantity, created_at)
        VALUES (?, ?, ?, 'purchase', ?, ?)
      `).run(movementId, productId, itemId, 2, now);
    });

    expect(() => tx2()).toThrow();

    const movements = db.prepare("SELECT * FROM stock_movements WHERE product_id = ?").all(productId) as MovementRow[];
    expect(movements).toHaveLength(1);
  });

  it("reconciliation mismatch is surfaced", () => {
    const result = reconcile([26000], [], 39000);
    expect(result.differenceMinor).toBe(13000);
    expect(result.calculatedMinor).toBe(26000);
  });
});