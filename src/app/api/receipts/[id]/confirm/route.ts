import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { confirmSchema } from "@/lib/receipt-schema";
import { reconcile } from "@/lib/calculations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const origin = request.headers.get("origin") ?? "";
  const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (origin !== appOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const db = getDb();

  const receipt = db.prepare("SELECT id, status, total_minor FROM receipts WHERE id = ?").get(id) as
    | { id: string; status: string; total_minor: number | null }
    | undefined;

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.status === "confirmed") {
    return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
  }

  if (receipt.status !== "review") {
    return NextResponse.json({ error: "Receipt not in review state" }, { status: 400 });
  }

  const lineTotals = data.items.map((i) => i.lineTotal);
  const adjustmentAmounts = data.adjustments.map((a) => a.amount);
  const { calculatedMinor, differenceMinor } = reconcile(lineTotals, adjustmentAmounts, data.total);

  if (differenceMinor !== 0 && !data.mismatchAcknowledged) {
    return NextResponse.json({
      error: "Reconciliation mismatch",
      calculatedMinor,
      differenceMinor,
      requiresAcknowledgment: true,
    }, { status: 409 });
  }

  const tx = db.transaction(() => {
    const now = new Date().toISOString();

    for (const item of data.items) {
      const product = db.prepare("SELECT id FROM products WHERE id = ?").get(item.productId) as
        | { id: string }
        | undefined;

      if (!product) {
        db.prepare(`
          INSERT INTO products (id, name, brand, category, base_unit, pack_size_base, low_stock_threshold)
          VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(item.productId, item.rawName, item.brand, "unknown", item.baseUnit, item.packSizeBase);
      }

      const itemId = randomUUID();
      db.prepare(`
        INSERT INTO receipt_items (id, receipt_id, product_id, raw_name, quantity, line_total_minor, source_line_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, id, item.productId, item.rawName, item.quantity, item.lineTotal, JSON.stringify(item.sourceLineIds));

      const movementId = randomUUID();
      db.prepare(`
        INSERT INTO stock_movements (id, product_id, receipt_item_id, kind, quantity, created_at)
        VALUES (?, ?, ?, 'purchase', ?, ?)
      `).run(movementId, item.productId, itemId, item.quantity, now);
    }

    for (const adj of data.adjustments) {
      const adjId = randomUUID();
      db.prepare(`
        INSERT INTO receipt_adjustments (id, receipt_id, label, amount_minor)
        VALUES (?, ?, ?, ?)
      `).run(adjId, id, adj.label, adj.amount);
    }

    db.prepare(`
      UPDATE receipts SET
        status = 'confirmed',
        store = ?,
        purchased_on = ?,
        currency = ?,
        total_minor = ?,
        confirmed_at = ?,
        mismatch_acknowledged = ?
      WHERE id = ?
    `).run(data.store, data.purchasedOn, data.currency, data.total, now, data.mismatchAcknowledged ? 1 : 0, id);

    return { id, status: "confirmed", confirmedAt: now };
  });

  try {
    const result = tx();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Confirm transaction failed:", error);
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}