import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const receipt = db.prepare(`
    SELECT id, image_path, sha256, status, store, purchased_on, currency, total_minor,
           raw_ocr, draft_json, error_code, mismatch_acknowledged, created_at, confirmed_at
    FROM receipts WHERE id = ?
  `).get(id) as
    | {
        id: string;
        image_path: string | null;
        sha256: string | null;
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
    | undefined;

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...receipt,
    totalMinor: receipt.total_minor,
    purchasedOn: receipt.purchased_on,
    mismatchAcknowledged: Boolean(receipt.mismatch_acknowledged),
    createdAt: receipt.created_at,
    confirmedAt: receipt.confirmed_at,
    draft: receipt.draft_json ? JSON.parse(receipt.draft_json) : null,
  });
}