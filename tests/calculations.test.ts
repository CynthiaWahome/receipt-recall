import { describe, it, expect } from "vitest";
import { parseMoney, parseSignedMoney, formatMoney, unitPriceMinor, reconcile, remainingStock } from "@/lib/calculations";

describe("parseMoney", () => {
  it("parses whole numbers", () => {
    expect(parseMoney("130")).toBe(13000);
  });

  it("parses decimal with two places", () => {
    expect(parseMoney("130.50")).toBe(13050);
  });

  it("parses decimal with one place", () => {
    expect(parseMoney("130.5")).toBe(13050);
  });

  it("strips commas", () => {
    expect(parseMoney("1,300.50")).toBe(130050);
  });

  it("rejects negative numbers", () => {
    expect(() => parseMoney("-130")).toThrow("Invalid amount");
  });

  it("rejects more than two decimal places", () => {
    expect(() => parseMoney("130.555")).toThrow("Invalid amount");
  });

  it("rejects non-numeric", () => {
    expect(() => parseMoney("abc")).toThrow("Invalid amount");
  });
});

describe("parseSignedMoney", () => {
  it("parses positive", () => {
    expect(parseSignedMoney("130.50")).toBe(13050);
  });

  it("parses negative", () => {
    expect(parseSignedMoney("-130.50")).toBe(-13050);
  });

  it("parses explicit positive", () => {
    expect(parseSignedMoney("+130.50")).toBe(13050);
  });
});

describe("formatMoney", () => {
  it("formats positive", () => {
    expect(formatMoney(13050)).toBe("130.50");
  });

  it("formats negative", () => {
    expect(formatMoney(-13050)).toBe("-130.50");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("0.00");
  });

  it("formats whole numbers", () => {
    expect(formatMoney(13000)).toBe("130.00");
  });
});

describe("unitPriceMinor", () => {
  it("calculates unit price", () => {
    expect(unitPriceMinor(26000, 2, 500)).toBe(26);
  });

  it("rejects negative total", () => {
    expect(() => unitPriceMinor(-100, 1, 100)).toThrow();
  });

  it("rejects zero quantity", () => {
    expect(() => unitPriceMinor(100, 0, 100)).toThrow();
  });

  it("rejects zero pack size", () => {
    expect(() => unitPriceMinor(100, 1, 0)).toThrow();
  });
});

describe("reconcile", () => {
  it("matches exact total", () => {
    const result = reconcile([13000, 26000], [-500], 38500);
    expect(result.calculatedMinor).toBe(38500);
    expect(result.differenceMinor).toBe(0);
  });

  it("detects mismatch", () => {
    const result = reconcile([13000, 26000], [-500], 39000);
    expect(result.calculatedMinor).toBe(38500);
    expect(result.differenceMinor).toBe(500);
  });

  it("rejects non-integer money", () => {
    expect(() => reconcile([13000.5], [], 13000)).toThrow("Use integer money");
  });
});

describe("remainingStock", () => {
  it("calculates purchase stock", () => {
    expect(remainingStock([{ kind: "purchase", quantity: 5 }])).toBe(5);
  });

  it("calculates used stock", () => {
    expect(remainingStock([{ kind: "purchase", quantity: 5 }, { kind: "used", quantity: 2 }])).toBe(3);
  });

  it("sets count", () => {
    expect(remainingStock([{ kind: "purchase", quantity: 5 }, { kind: "count", quantity: 3 }])).toBe(3);
  });

  it("rejects negative stock", () => {
    expect(() => remainingStock([{ kind: "purchase", quantity: 2 }, { kind: "used", quantity: 5 }])).toThrow("Cannot use more than recorded stock");
  });

  it("rejects negative quantity", () => {
    expect(() => remainingStock([{ kind: "purchase", quantity: -1 }])).toThrow("Invalid stock");
  });
});