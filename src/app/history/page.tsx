import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

function formatMinor(minor: number, currency: string): string {
  const whole = Math.floor(minor / 100);
  const fraction = (minor % 100).toString().padStart(2, "0");
  return `${currency} ${whole}.${fraction}`;
}

interface ConfirmedRow {
  id: string;
  store: string | null;
  purchased_on: string | null;
  currency: string;
  total_minor: number | null;
  item_count: number;
}

export default function HistoryPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Spending</h1>
        <Link
          href="/receipts/new"
          className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
        >
          Scan receipt
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <HistoryContent />
      </Suspense>
    </main>
  );
}

async function HistoryContent() {
  await connection(); // read the DB at request time, not during build
  const db = getDb();

  const receipts = db
    .prepare(
      `SELECT r.id, r.store, r.purchased_on, r.currency, r.total_minor,
              (SELECT COUNT(*) FROM receipt_items ri WHERE ri.receipt_id = r.id) AS item_count
       FROM receipts r
       WHERE r.status = 'confirmed'
       ORDER BY r.purchased_on DESC, r.confirmed_at DESC`
    )
    .all() as ConfirmedRow[];

  // Current-month spend, kept separate per currency (never summed across currencies).
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthTotals = new Map<string, number>();
  for (const r of receipts) {
    if (r.purchased_on?.startsWith(month) && r.total_minor != null) {
      monthTotals.set(r.currency, (monthTotals.get(r.currency) ?? 0) + r.total_minor);
    }
  }

  return (
    <>
      <section className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          This month ({month})
        </h2>
        {monthTotals.size === 0 ? (
          <p className="text-2xl font-bold">No confirmed receipts yet</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {[...monthTotals.entries()].map(([currency, total]) => (
              <div key={currency} className="text-3xl font-bold font-mono">
                {formatMinor(total, currency)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">All confirmed receipts</h2>
        {receipts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-muted-foreground">
            Nothing saved yet.{" "}
            <Link href="/receipts/new" className="text-primary underline">
              Scan your first receipt
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Store</th>
                <th className="py-2 text-right">Items</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2">{r.purchased_on || "—"}</td>
                  <td className="py-2">
                    <Link href={`/receipts/${r.id}`} className="text-primary hover:underline">
                      {r.store || "Receipt"}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{r.item_count}</td>
                  <td className="py-2 text-right font-mono">
                    {formatMinor(r.total_minor ?? 0, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
