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
  totalMinor: number;
  mismatchAcknowledged: boolean;
  items: Item[];
  adjustments: Adjustment[];
}

export default function ReviewReceiptClient() {
  const resolvedParams = useParams();
  const router = useRouter();
  const id = resolvedParams.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          store: data.store || "",
          purchasedOn: data.purchasedOn || "",
          currency: data.currency,
          totalMinor: data.totalMinor,
          mismatchAcknowledged: data.mismatchAcknowledged,
          items: data.draft?.items || [],
          adjustments: data.draft?.adjustments || [],
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

  function parseMinor(text: string): number {
    const cleaned = text.trim().replaceAll(",", "");
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

  async function handleConfirm() {
    if (!receipt) return;
    setError("");
    setSaving(true);

    const payload = {
      store: receipt.store,
      purchasedOn: receipt.purchasedOn,
      currency: receipt.currency,
      total: receipt.totalMinor,
      items: receipt.items.map((item) => ({
        rawName: item.rawName,
        quantity: parseFloat(item.quantity),
        lineTotal: parseMinor(item.lineTotal),
        productId: item.productId,
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
  const differenceMinor = receipt.totalMinor - calculatedMinor;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">Review Receipt</h1>

      {mismatch && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">
          <p className="font-medium">Reconciliation mismatch detected!</p>
          <p>Receipt total: {formatMinor(receipt.totalMinor)}</p>
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
          <label className="block text-sm font-medium mb-1">Total (minor units)</label>
          <input
            type="number"
            value={receipt.totalMinor}
            onChange={(e) => setReceipt({ ...receipt!, totalMinor: parseInt(e.target.value, 10) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            min="0"
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
            <span className="text-sm text-gray-600">Calculated:</span>
            <div className="font-mono text-lg">{formatMinor(calculatedMinor)}</div>
          </div>
          <div className="md:col-span-3">
            <span className="text-sm text-gray-600">Receipt total:</span>
            <div className="font-mono text-lg">{formatMinor(receipt.totalMinor)}</div>
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
              <label className="block text-sm font-medium mb-1">Line Total (minor)</label>
              <input
                type="text"
                value={item.lineTotal}
                onChange={(e) => handleItemChange(index, "lineTotal", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Product ID</label>
              <input
                type="text"
                value={item.productId}
                onChange={(e) => handleItemChange(index, "productId", e.target.value)}
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
              <label className="block text-sm font-medium mb-1">Pack Size Base</label>
              <input
                type="number"
                step="0.01"
                value={item.packSizeBase}
                onChange={(e) => handleItemChange(index, "packSizeBase", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Base Unit</label>
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
            <div>
              <label className="block text-sm font-medium mb-1">Source Line IDs</label>
              <input
                type="text"
                value={item.sourceLineIds}
                onChange={(e) => handleItemChange(index, "sourceLineIds", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
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
              placeholder="Amount (minor, negative for discounts)"
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
    </main>
  );
}