import { getDb } from "@/lib/db";
import { runOcr, numberLines } from "@/lib/ocr";
import { extractFromOcr } from "@/lib/extract";
import { NextRequest, NextResponse } from "next/server";

const processingFlag = { current: false };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const origin = request.headers.get("origin") ?? "";
  const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (origin !== appOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const db = getDb();

  const receipt = db.prepare("SELECT id, status, image_path FROM receipts WHERE id = ?").get(id) as
    | { id: string; status: string; image_path: string | null }
    | undefined;

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.status === "confirmed") {
    return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
  }

  if (receipt.status === "processing") {
    return NextResponse.json({ error: "Already processing" }, { status: 409 });
  }

  if (!receipt.image_path) {
    return NextResponse.json({ error: "No image to process" }, { status: 400 });
  }

  if (processingFlag.current) {
    return NextResponse.json({ error: "Busy", code: "BUSY" }, { status: 503 });
  }

  processingFlag.current = true;

  try {
    db.prepare("UPDATE receipts SET status = 'processing' WHERE id = ?").run(id);

    let ocrResult;
    try {
      ocrResult = await runOcr(receipt.image_path);
    } catch (error) {
      db.prepare("UPDATE receipts SET status = 'failed', error_code = 'OCR_FAILED' WHERE id = ?").run(id);
      throw error;
    }

    if (!ocrResult.lines.length) {
      db.prepare("UPDATE receipts SET status = 'failed', error_code = 'EMPTY_OCR', raw_ocr = ? WHERE id = ?").run(ocrResult.text, id);
      return NextResponse.json({ error: "OCR returned no text", code: "EMPTY_OCR" }, { status: 422 });
    }

    const numberedLines = numberLines(ocrResult.lines);
    const ollamaUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
    const model = process.env.OLLAMA_MODEL ?? "gemma3:1b";

    let extractResult;
    try {
      extractResult = await extractFromOcr(numberedLines, { ollamaUrl, model });
    } catch (error) {
      db.prepare("UPDATE receipts SET status = 'failed', error_code = 'EXTRACT_FAILED', raw_ocr = ? WHERE id = ?").run(ocrResult.text, id);
      throw error;
    }

    db.prepare(
      "UPDATE receipts SET status = 'review', raw_ocr = ?, draft_json = ? WHERE id = ?"
    ).run(ocrResult.text, JSON.stringify(extractResult.draft), id);

    return NextResponse.json({
      status: "review",
      draft: extractResult.draft,
      ocrText: ocrResult.text,
    });
  } catch (error) {
    console.error("Process failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  } finally {
    processingFlag.current = false;
  }
}