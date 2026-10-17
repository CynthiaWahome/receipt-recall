import { describe, it, expect, vi, beforeEach } from "vitest";
import { numberLines } from "@/lib/ocr";
import { extractFromOcr } from "@/lib/extract";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn) => fn),
}));

describe("ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("numbers lines correctly", () => {
    const lines = ["Item 1", "Item 2", "Item 3"];
    const result = numberLines(lines);
    expect(result).toEqual([
      { id: "L1", text: "Item 1" },
      { id: "L2", text: "Item 2" },
      { id: "L3", text: "Item 3" },
    ]);
  });

  it("preserves all lines including empty", () => {
    const lines = ["Item 1", "", "  ", "Item 2"];
    const result = numberLines(lines);
    expect(result).toEqual([
      { id: "L1", text: "Item 1" },
      { id: "L2", text: "" },
      { id: "L3", text: "  " },
      { id: "L4", text: "Item 2" },
    ]);
  });
});

describe("extractFromOcr", () => {
  const lines = [
    { id: "L1", text: "Store Name" },
    { id: "L2", text: "Apple 1.50" },
    { id: "L3", text: "Bread 2.00" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated draft on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: JSON.stringify({
          store: "Store Name",
          purchasedOn: "2026-01-15",
          currency: "KES",
          total: 350,
          items: [
            { rawName: "Apple", quantity: 1, lineTotal: 150, productId: null, brand: null, packSizeBase: null, baseUnit: "each", sourceLineIds: ["L2"] },
            { rawName: "Bread", quantity: 1, lineTotal: 200, productId: null, brand: null, packSizeBase: null, baseUnit: "each", sourceLineIds: ["L3"] },
          ],
          adjustments: [],
        }),
      }),
    });

    const result = await extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" });
    expect(result.draft.store).toBe("Store Name");
    expect(result.draft.items).toHaveLength(2);
  });

  it("throws on invalid JSON from model", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: "not json" }),
    });

    await expect(extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" }))
      .rejects.toThrow("Model returned invalid JSON");
  });

  it("throws on validation failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: JSON.stringify({ invalid: true }) }),
    });

    await expect(extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" }))
      .rejects.toThrow("Model output failed validation");
  });

  it("throws on invalid sourceLineId", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: JSON.stringify({
          store: "Store",
          purchasedOn: "2026-01-15",
          currency: "KES",
          total: 150,
          items: [{ rawName: "Apple", quantity: 1, lineTotal: 150, productId: null, brand: null, packSizeBase: null, baseUnit: "each", sourceLineIds: ["L99"] }],
          adjustments: [],
        }),
      }),
    });

    await expect(extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" }))
      .rejects.toThrow("Invalid sourceLineId");
  });

  it("throws on Ollama error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" }))
      .rejects.toThrow("Ollama error: 500 Internal Server Error");
  });

  it("throws on timeout", async () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 10);
    }));

    await expect(extractFromOcr(lines, { ollamaUrl: "http://localhost:11434", model: "gemma3:1b" }))
      .rejects.toThrow("Extraction timeout");
  });
});