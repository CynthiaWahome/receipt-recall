"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
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
  id: string;
  label: string;
  amount: string;
}

export default function NewReceiptClient() {
  const router = useRouter();

  function randomId() {
    return Math.random().toString(36).slice(2, 10);
  }

  const [store, setStore] = useState("");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [total, setTotal] = useState("");
  const [items, setItems] = useState<Item[]>(() => [
    { id: randomId(), rawName: "", quantity: "", lineTotal: "", productId: "", brand: "", packSizeBase: "", baseUnit: "each", sourceLineIds: "L1" },
  ]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function addItem() {
    setItems([...items, { id: randomId(), rawName: "", quantity: "", lineTotal: "", productId: "", brand: "", packSizeBase: "", baseUnit: "each", sourceLineIds: `L${items.length + 1}` }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof Item, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addAdjustment() {
    setAdjustments([...adjustments, { id: randomId(), label: "", amount: "" }]);
  }

  function removeAdjustment(index: number) {
    setAdjustments(adjustments.filter((_, i) => i !== index));
  }

  function updateAdjustment(index: number, field: keyof Adjustment, value: string) {
    setAdjustments(adjustments.map((adj, i) => (i === index ? { ...adj, [field]: value } : adj)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    const payload = {
      store,
      purchasedOn,
      currency,
      total: parseInt(total, 10),
      items: items.map((item) => ({
        rawName: item.rawName,
        quantity: item.quantity ? parseFloat(item.quantity) : null,
        lineTotal: parseInt(item.lineTotal, 10),
        productId: item.productId || null,
        brand: item.brand || null,
        packSizeBase: item.packSizeBase ? parseFloat(item.packSizeBase) : null,
        baseUnit: item.baseUnit,
        sourceLineIds: item.sourceLineIds.split(",").map((s) => s.trim()).filter(Boolean),
      })),
      adjustments: adjustments.map((adj) => ({
        label: adj.label,
        amount: parseInt(adj.amount, 10),
      })),
    };

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create receipt");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/receipts/${data.id}/review`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-6">New Manual Receipt</h1>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">Receipt created! Redirecting...</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="store" className="block text-sm font-medium mb-1">Store</label>
            <input
              id="store"
              type="text"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="purchasedOn" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Date</label>
            <input
              id="purchasedOn"
              type="date"
              value={purchasedOn}
              onChange={(e) => setPurchasedOn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-gray-900"
              required
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium mb-1">Currency</label>
            <input
              id="currency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={3}
              required
            />
          </div>
          <div>
            <label htmlFor="total" className="block text-sm font-medium mb-1">Total (minor units, e.g. 13000 for 130.00)</label>
            <input
              id="total"
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              min="0"
              required
            />
          </div>
        </div>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-lg font-medium mb-4">Items</legend>
          {items.map((item, index) => (
            <div key={item.id} className="grid gap-3 md:grid-cols-4 mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  value={item.rawName}
                  onChange={(e) => updateItem(index, "rawName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Line Total (minor)</label>
                <input
                  type="number"
                  value={item.lineTotal}
                  onChange={(e) => updateItem(index, "lineTotal", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Product ID (UUID)</label>
                <input
                  type="text"
                  value={item.productId}
                  onChange={(e) => updateItem(index, "productId", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Leave blank to auto-create"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Brand</label>
                <input
                  type="text"
                  value={item.brand}
                  onChange={(e) => updateItem(index, "brand", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Pack Size Base</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.packSizeBase}
                  onChange={(e) => updateItem(index, "packSizeBase", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Base Unit</label>
                <select
                  value={item.baseUnit}
                  onChange={(e) => updateItem(index, "baseUnit", e.target.value as "ml" | "g" | "each")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                  <option value="each">each</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source Line IDs (comma-separated)</label>
                <input
                  type="text"
                  value={item.sourceLineIds}
                  onChange={(e) => updateItem(index, "sourceLineIds", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="self-end text-red-600 hover:underline text-sm">
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-primary hover:underline">
            + Add Item
          </button>
        </fieldset>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-lg font-medium mb-4">Adjustments (discounts, fees, etc.)</legend>
          {adjustments.map((adj, index) => (
            <div key={adj.id} className="flex gap-3 mb-3">
              <input
                type="text"
                value={adj.label}
                onChange={(e) => updateAdjustment(index, "label", e.target.value)}
                placeholder="Label (e.g. Loyalty discount)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                value={adj.amount}
                onChange={(e) => updateAdjustment(index, "amount", e.target.value)}
                placeholder="Amount (minor, negative for discounts)"
                className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
            type="submit"
            disabled={saving}
            className="flex-1 py-3 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Create Receipt"}
          </button>
        </div>
      </form>
    </main>
  );
}