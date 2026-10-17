"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface Item {
  rawName: string;
  quantity: string;
  lineTotal: string;
  productId: string;
  brand: string;
  packSizeBase: string;
  baseUnit: "ml" | "g" | "each";
  sourceLineIds: string;
}

interface Adjustment {
  label: string;
  amount: string;
}

interface Receipt {
  id: string;
  status: string;
  store: string;
  purchasedOn: string;
  currency: string;
  total: string; // major units, e.g. "380.00"
  mismatchAcknowledged: boolean;
  items: Item[];
  adjustments: Adjustment[];
  imagePath: string | null;
}

// A draft item as it arrives from the AI extraction (numbers, nulls, arrays).
interface DraftItemRaw {
  rawName?: string;
  quantity?: number | null;
  lineTotal?: number | null;
  productId?: string | null;
  brand?: string | null;
  packSizeBase?: number | null;
  baseUnit?: "ml" | "g" | "each" | null;
  sourceLineIds?: string[] | string | null;
}

interface DraftAdjustmentRaw {
  label?: string;
  amount?: number | null;
}

// The editable form holds everything as strings; normalize the draft into it.
function itemsToForm(items?: DraftItemRaw[]): Item[] {
  return (items ?? []).map((it) => ({
    rawName: it.rawName ?? "",
    quantity: it.quantity == null ? "" : String(it.quantity),
    lineTotal: it.lineTotal == null ? "" : (it.lineTotal / 100).toFixed(2),
    productId: it.productId ?? "",
    brand: it.brand ?? "",
    packSizeBase: it.packSizeBase == null ? "" : String(it.packSizeBase),
    baseUnit: it.baseUnit ?? "each",
    sourceLineIds: Array.isArray(it.sourceLineIds)
      ? it.sourceLineIds.join(",")
      : (it.sourceLineIds ?? ""),
  }));
}

function adjustmentsToForm(adjustments?: DraftAdjustmentRaw[]): Adjustment[] {
  return (adjustments ?? []).map((a) => ({
    label: a.label ?? "",
    amount: a.amount == null ? "" : (a.amount / 100).toFixed(2),
  }));
}

export default function ReviewReceiptClient() {
  const resolvedParams = useParams();
  const router = useRouter();
  const id = resolvedParams.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);

  useEffect(() => {
    fetch(`/api/receipts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load receipt");
        return res.json();
      })
      .then((data) => {
        setReceipt({
          id: data.id,
          status: data.status,
          store: data.store || data.draft?.store || "",
          purchasedOn: data.purchasedOn || data.draft?.purchasedOn || "",
          currency: data.currency || data.draft?.currency || "KES",
          total: ((data.totalMinor ?? data.draft?.total ?? 0) / 100).toFixed(2),
          mismatchAcknowledged: data.mismatchAcknowledged,
          items: itemsToForm(data.draft?.items),
          adjustments: adjustmentsToForm(data.draft?.adjustments),
          imagePath: data.image_path,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function formatMinor(minor: number): string {
    const abs = Math.abs(minor);
    const whole = Math.floor(abs / 100);
    const fraction = (abs % 100).toString().padStart(2, "0");
    return `${minor < 0 ? "-" : ""}${whole}.${fraction}`;
  }

  // Money fields in this form are human-friendly major units ("130.00"),
  // possibly negative for discounts. Parse to integer minor units for the API.
  function parseMinor(text: string): number {
    const cleaned = String(text).trim().replaceAll(",", "");
    const sign = cleaned.startsWith("-") ? -1 : 1;
    const unsigned = cleaned.replace(/^[-+]/, "");
    if (!/^\d+(\.\d{1,2})?$/.test(unsigned)) return 0;
    const [whole, fraction = ""] = unsigned.split(".");
    return sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  }

  function handleItemChange(index: number, field: keyof Item, value: string) {
    setReceipt((prev) =>
      prev
        ? { ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }
        : null
    );
  }

  function handleAdjustmentChange(index: number, field: keyof Adjustment, value: string) {
    setReceipt((prev) =>
      prev
        ? { ...prev, adjustments: prev.adjustments.map((adj, i) => (i === index ? { ...adj, [field]: value } : adj)) }
        : null
    );
  }

  function addAdjustment() {
    setReceipt((prev) =>
      prev
        ? { ...prev, adjustments: [...prev.adjustments, { label: "", amount: "" }] }
        : null
    );
  }

  function removeAdjustment(index: number) {
    setReceipt((prev) =>
      prev
        ? { ...prev, adjustments: prev.adjustments.filter((_, i) => i !== index) }
        : null
    );
  }

  async function handleProcess() {
    if (!receipt) return;
    setError("");
    setProcessing(true);

    try {
      const res = await fetch(`/api/receipts/${id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Processing failed");
      }

      setReceipt((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              store: data.draft?.store || prev.store,
              purchasedOn: data.draft?.purchasedOn || prev.purchasedOn,
              currency: data.draft?.currency || prev.currency,
              total: data.draft?.total != null ? (data.draft.total / 100).toFixed(2) : prev.total,
              items: itemsToForm(data.draft?.items),
              adjustments: adjustmentsToForm(data.draft?.adjustments),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm() {
    if (!receipt) return;
    setError("");
    setSaving(true);

    const payload = {
      store: receipt.store,
      purchasedOn: receipt.purchasedOn,
      currency: receipt.currency,
      total: parseMinor(receipt.total),
      items: receipt.items.map((item) => ({
        rawName: item.rawName,
        quantity: parseFloat(item.quantity),
        lineTotal: parseMinor(item.lineTotal),
        // Scanned drafts have no product yet; mint one so confirm can create it.
        productId: item.productId?.trim() ? item.productId : crypto.randomUUID(),
        brand: item.brand || null,
        packSizeBase: parseFloat(item.packSizeBase),
        baseUnit: item.baseUnit,
        sourceLineIds: item.sourceLineIds.split(",").map((s) => s.trim()).filter(Boolean),
      })),
      adjustments: receipt.adjustments.map((adj) => ({
        label: adj.label,
        amount: parseMinor(adj.amount),
      })),
      mismatchAcknowledged,
    };

    try {
      const res = await fetch(`/api/receipts/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresAcknowledgment) {
          setMismatch(true);
          setError(`Reconciliation mismatch: calculated ${formatMinor(data.calculatedMinor)}, difference ${formatMinor(data.differenceMinor)}`);
          return;
        }
        throw new Error(data.error || "Confirmation failed");
      }

      router.push(`/receipts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-8 text-center">Loading...</div>;
  if (error && !mismatch) return <div className="max-w-4xl mx-auto px-6 py-8 text-center text-red-600">{error}</div>;
  if (!receipt) return <div className="max-w-4xl mx-auto px-6 py-8 text-center">Receipt not found</div>;

  const calculatedMinor = receipt.items.reduce((sum, i) => sum + parseMinor(i.lineTotal), 0) +
    receipt.adjustments.reduce((sum, a) => sum + parseMinor(a.amount), 0);
  const totalMinor = parseMinor(receipt.total);
  const differenceMinor = totalMinor - calculatedMinor;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Review Receipt</h1>
        {receipt.imagePath && receipt.status === "review" && receipt.items.length === 0 && (
          <button
            onClick={handleProcess}
            disabled={processing}
            className="py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {processing ? "Processing..." : "Extract with OCR + AI"}
          </button>
        )}
      </div>

      {mismatch && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">
          <p className="font-medium">Reconciliation mismatch detected!</p>
          <p>Receipt total: {formatMinor(totalMinor)}</p>
          <p>Calculated total: {formatMinor(calculatedMinor)}</p>
          <p>Difference: {formatMinor(differenceMinor)}</p>
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={mismatchAcknowledged}
              onChange={(e) => setMismatchAcknowledged(e.target.checked)}
              className="rounded border-gray-300"
            />
            I acknowledge this mismatch and want to proceed
          </label>
        </div>
      )}

      {error && !mismatch && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {receipt.imagePath && (
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium mb-2">Receipt Photo</h3>
              <img
                src={`/api/receipts/${id}/image`}
                alt="Receipt"
                className="w-full h-auto rounded-lg border border-gray-200"
              />
            </div>
          </div>
        )}

        <div className={receipt.imagePath ? "lg:col-span-2" : ""}>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Store</label>
              <input
                type="text"
                value={receipt.store}
                onChange={(e) => setReceipt({ ...receipt!, store: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="text"
                value={receipt.purchasedOn}
                onChange={(e) => setReceipt({ ...receipt!, purchasedOn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                pattern="\\d{4}-\\d{2}-\\d{2}"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <input
                type="text"
                value={receipt.currency}
                onChange={(e) => setReceipt({ ...receipt!, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total ({receipt.currency})</label>
              <input
                type="text"
                inputMode="decimal"
                value={receipt.total}
                onChange={(e) => setReceipt({ ...receipt!, total: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Reconciliation</h3>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <span className="text-sm text-gray-600">Line items total:</span>
                <div className="font-mono text-lg">{formatMinor(receipt.items.reduce((s, i) => s + parseMinor(i.lineTotal), 0))}</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Adjustments:</span>
                <div className="font-mono text-lg">{formatMinor(receipt.adjustments.reduce((s, a) => s + parseMinor(a.amount), 0))}</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Calculated:</span>
                <div className="font-mono text-lg">{formatMinor(calculatedMinor)}</div>
              </div>
              <div className="md:col-span-3">
                <span className="text-sm text-gray-600">Receipt total:</span>
                <div className="font-mono text-lg">{formatMinor(totalMinor)}</div>
              </div>
              <div className="md:col-span-3">
                <span className="text-sm text-gray-600">Difference:</span>
                <div className={`font-mono text-lg ${differenceMinor !== 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMinor(differenceMinor)}
                </div>
              </div>
            </div>
          </div>

          <fieldset className="border border-gray-200 rounded-lg p-4 mb-6">
            <legend className="text-lg font-medium mb-4">Items</legend>
            {receipt.items.map((item, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-4 mb-4 p-3 bg-white rounded-lg border">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Item Name</label>
                  <input
                    type="text"
                    value={item.rawName}
                    onChange={(e) => handleItemChange(index, "rawName", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Line total ({receipt.currency})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.lineTotal}
                    onChange={(e) => handleItemChange(index, "lineTotal", e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Brand</label>
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) => handleItemChange(index, "brand", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pack size</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.packSizeBase}
                    onChange={(e) => handleItemChange(index, "packSizeBase", e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Unit</label>
                  <select
                    value={item.baseUnit}
                    onChange={(e) => handleItemChange(index, "baseUnit", e.target.value as "ml" | "g" | "each")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="each">each</option>
                  </select>
                </div>
              </div>
            ))}
          </fieldset>

          <fieldset className="border border-gray-200 rounded-lg p-4 mb-6">
            <legend className="text-lg font-medium mb-4">Adjustments</legend>
            {receipt.adjustments.map((adj, index) => (
              <div key={index} className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={adj.label}
                  onChange={(e) => handleAdjustmentChange(index, "label", e.target.value)}
                  placeholder="Label"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={adj.amount}
                  onChange={(e) => handleAdjustmentChange(index, "amount", e.target.value)}
                  inputMode="decimal"
                  placeholder="− for discounts, e.g. -20.00"
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
                <button type="button" onClick={() => removeAdjustment(index)} className="self-end text-red-600 hover:underline text-sm">
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={addAdjustment} className="text-primary hover:underline">
              + Add Adjustment
            </button>
          </fieldset>

          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={saving || (mismatch && !mismatchAcknowledged)}
              className="flex-1 py-3 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Confirming..." : "Confirm Receipt"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}