import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";

function formatMinor(minor: number, currency: string): string {
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${minor < 0 ? "-" : ""}${currency} ${whole}.${fraction}`;
}

interface ReceiptRow {
  id: string;
  status: string;
  store: string | null;
  purchased_on: string | null;
  currency: string;
  total_minor: number | null;
  image_path: string | null;
  confirmed_at: string | null;
}

interface ItemRow {
  raw_name: string;
  quantity: number;
  line_total_minor: number;
}

interface AdjustmentRow {
  label: string;
  amount_minor: number;
}

export default function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-6 py-8 text-center">Loading…</div>}>
      <ReceiptDetailContent params={params} />
    </Suspense>
  );
}

async function ReceiptDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection(); // read the DB at request time, not during build
  const { id } = await params;
  const db = getDb();

  const receipt = db
    .prepare(
      `SELECT id, status, store, purchased_on, currency, total_minor, image_path, confirmed_at
       FROM receipts WHERE id = ?`
    )
    .get(id) as ReceiptRow | undefined;

  if (!receipt) notFound();

  // Not yet confirmed — send the user to the review screen instead.
  if (receipt.status !== "confirmed") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Receipt not confirmed yet</h1>
        <Link href={`/receipts/${id}/review`} className="text-primary underline">
          Go to review
        </Link>
      </main>
    );
  }

  const items = db
    .prepare(
      `SELECT raw_name, quantity, line_total_minor FROM receipt_items WHERE receipt_id = ?`
    )
    .all(id) as ItemRow[];

  const adjustments = db
    .prepare(
      `SELECT label, amount_minor FROM receipt_adjustments WHERE receipt_id = ?`
    )
    .all(id) as AdjustmentRow[];

  const currency = receipt.currency;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{receipt.store || "Receipt"}</h1>
          <p className="text-muted-foreground">{receipt.purchased_on} · confirmed</p>
        </div>
        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-medium">
          Saved
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {receipt.image_path && (
          <div className="lg:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/receipts/${id}/image`}
              alt="Receipt"
              className="w-full h-auto rounded-lg border border-gray-200"
            />
          </div>
        )}

        <div className={receipt.image_path ? "lg:col-span-2" : "lg:col-span-3"}>
          <table className="w-full text-left mb-6">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{item.raw_name}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-mono">
                    {formatMinor(item.line_total_minor, currency)}
                  </td>
                </tr>
              ))}
              {adjustments.map((adj, i) => (
                <tr key={`adj-${i}`} className="border-b border-gray-100 text-amber-700">
                  <td className="py-2">{adj.label}</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right font-mono">
                    {formatMinor(adj.amount_minor, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td className="py-2">Total</td>
                <td></td>
                <td className="py-2 text-right font-mono">
                  {formatMinor(receipt.total_minor ?? 0, currency)}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="flex gap-4">
            <Link href="/history" className="text-primary underline">
              View all receipts
            </Link>
            <Link href="/receipts/new" className="text-primary underline">
              Scan another
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
