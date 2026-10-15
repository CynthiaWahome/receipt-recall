export function parseMoney(text: string): number {
  const cleaned = String(text).trim().replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error("Invalid amount");
  const [whole, fraction = ""] = cleaned.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Amount too large");
  return amount;
}

export function parseSignedMoney(text: string): number {
  const cleaned = String(text).trim().replaceAll(",", "");
  const sign = cleaned.startsWith("-") ? -1 : 1;
  const unsigned = cleaned.replace(/^[-+]/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(unsigned)) throw new Error("Invalid signed amount");
  const [whole, fraction = ""] = unsigned.split(".");
  const amount = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(amount)) throw new Error("Amount too large");
  return amount;
}

export function formatMoney(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error("Amount too large");
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function unitPriceMinor(lineTotalMinor: number, quantity: number, packSizeBase: number): number {
  if (!Number.isSafeInteger(lineTotalMinor) || lineTotalMinor < 0 ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(packSizeBase) || packSizeBase <= 0) {
    throw new Error("Need a price, positive quantity and pack size");
  }
  return lineTotalMinor / (quantity * packSizeBase);
}

export interface ReconcileResult {
  calculatedMinor: number;
  differenceMinor: number;
}

export function reconcile(
  lineTotals: number[],
  adjustments: number[],
  receiptTotalMinor: number
): ReconcileResult {
  const amounts = [...lineTotals, ...adjustments];
  if (!amounts.every(Number.isSafeInteger) ||
      !Number.isSafeInteger(receiptTotalMinor)) throw new Error("Use integer money");
  const calculatedMinor = amounts.reduce((sum, n) => sum + n, 0);
  if (!Number.isSafeInteger(calculatedMinor)) throw new Error("Amount too large");
  return { calculatedMinor, differenceMinor: receiptTotalMinor - calculatedMinor };
}

export interface StockMovement {
  kind: "purchase" | "used" | "wasted" | "count";
  quantity: number;
}

export function remainingStock(movements: StockMovement[]): number {
  let remaining = 0;
  for (const m of movements) {
    if (!Number.isFinite(m.quantity) || m.quantity < 0) throw new Error("Invalid stock");
    if (m.kind === "count") remaining = m.quantity;
    else if (m.kind === "purchase") remaining += m.quantity;
    else if (m.kind === "used" || m.kind === "wasted") remaining -= m.quantity;
    else throw new Error("Unknown movement");
    if (remaining < 0) throw new Error("Cannot use more than recorded stock; count it first");
  }
  return remaining;
}