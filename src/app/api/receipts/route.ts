import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

  const { store, purchasedOn, currency = "KES", total, items } = body as {
    store?: string;
    purchasedOn?: string;
    currency?: string;
    total?: number;
    items?: Array<{
      rawName: string;
      quantity?: number | null;
      lineTotal: number;
      productId?: string | null;
      brand?: string | null;
      packSizeBase?: number | null;
      baseUnit?: "ml" | "g" | "each" | null;
      sourceLineIds: string[];
    }>;
    adjustments?: Array<{ label: string; amount: number }>;
  };

  if (!store || !purchasedOn || total === undefined || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedOn)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO receipts (id, status, store, purchased_on, currency, total_minor, created_at)
      VALUES (?, 'review', ?, ?, ?, ?, ?)
    `).run(id, store, purchasedOn, currency, total, now);

    return { id, status: "review", createdAt: now };
  });

  try {
    const result = tx();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Create receipt failed:", error);
    return NextResponse.json({ error: "Failed to create receipt" }, { status: 500 });
  }
}