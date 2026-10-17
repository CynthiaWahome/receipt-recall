import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (the real guard against huge uploads)
// Decompression-bomb guard only. Modern phones shoot up to 48 MP, so 24 MP was
// too low; 100 MP fits any real photo while still blocking absurd bombs. The
// 8 MB byte cap above plus the downscale below are the practical limits.
const MAX_PIXELS = 100_000_000; // 100 MP
const LONG_EDGE = 2500; // normalized long edge in px

// Detect HEIC/HEIF by its container magic bytes (ftyp box brand), independent
// of the browser-reported MIME type, which iOS often leaves empty.
function looksLikeHeic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "heif"].includes(brand);
}

function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin") ?? "";
  const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (origin !== appOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}

// Photo upload: normalize with sharp, dedup by SHA-256, store privately,
// insert a receipt in `review` with an image but no draft yet. The review
// page then calls /process to run OCR + extraction.
async function handlePhotoUpload(request: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }
  // Accept JPEG/PNG and iPhone HEIC/HEIF. iOS sometimes reports an empty type,
  // so anything image-ish is passed to sharp, which is the real validator below.
  const ACCEPTED = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
  if (file.type && !ACCEPTED.has(file.type) && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const db = getDb();

  // Exact-duplicate upload returns the existing receipt — never a new record.
  const existing = db
    .prepare("SELECT id, status FROM receipts WHERE sha256 = ?")
    .get(sha256) as { id: string; status: string } | undefined;
  if (existing) {
    return NextResponse.json({ id: existing.id, status: existing.status, duplicate: true });
  }

  // iPhone HEIC/HEIF uses HEVC-compressed pixels that sharp's bundled libheif
  // cannot decode, so convert to JPEG first with the pure-JS decoder. Everything
  // else goes straight to sharp.
  let inputBytes: Buffer = bytes;
  if (looksLikeHeic(bytes) || file.type === "image/heic" || file.type === "image/heif") {
    try {
      const convert = (await import("heic-convert")).default;
      const jpg = await convert({ buffer: bytes, format: "JPEG", quality: 0.9 });
      inputBytes = Buffer.from(jpg);
    } catch (error) {
      console.error("HEIC conversion failed:", error);
      return NextResponse.json(
        { error: "Could not read this HEIC photo. Try again or use a JPEG/PNG." },
        { status: 400 }
      );
    }
  }

  // Decode defensively: cap pixels, honour EXIF orientation, drop metadata,
  // downscale the long edge, re-encode as PNG. An extension proves nothing —
  // sharp throws on anything that is not a real decodable image.
  let normalized: Buffer;
  try {
    const pipeline = sharp(inputBytes, { limitInputPixels: MAX_PIXELS }).rotate();
    const meta = await pipeline.metadata();
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_PIXELS) {
      return NextResponse.json({ error: "Image resolution too high" }, { status: 413 });
    }
    normalized = await pipeline
      .resize(LONG_EDGE, LONG_EDGE, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("Image decode failed:", error);
    return NextResponse.json(
      { error: "Could not read this image. Try a JPEG, PNG or HEIC photo." },
      { status: 400 }
    );
  }

  const dataDir = process.env.DATA_DIR ?? "./data";
  const imagesDir = resolve(dataDir, "images");
  await mkdir(imagesDir, { recursive: true });

  const imageUuid = randomUUID();
  const imagePath = resolve(imagesDir, `${imageUuid}.png`);
  await writeFile(imagePath, normalized);

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO receipts (id, image_path, sha256, status, currency, created_at)
     VALUES (?, ?, ?, 'review', 'KES', ?)`
  ).run(id, imagePath, sha256, now);

  return NextResponse.json({ id, status: "review" });
}

// Manual entry (JSON) — the fallback for unreadable receipts. Inserts the
// receipt header; items are entered and saved on the review screen at confirm.
async function handleManualEntry(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { store, purchasedOn, currency = "KES", total } = body as {
    store?: string;
    purchasedOn?: string;
    currency?: string;
    total?: number;
  };

  if (!store || !purchasedOn || total === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedOn)) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO receipts (id, status, store, purchased_on, currency, total_minor, created_at)
       VALUES (?, 'review', ?, ?, ?, ?, ?)`
    ).run(id, store, purchasedOn, currency, total, now);
    return NextResponse.json({ id, status: "review", createdAt: now });
  } catch (error) {
    console.error("Create receipt failed:", error);
    return NextResponse.json({ error: "Failed to create receipt" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handlePhotoUpload(request);
  }
  return handleManualEntry(request);
}
