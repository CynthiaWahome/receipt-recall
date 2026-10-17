import { getDb } from "@/lib/db";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const receipt = db.prepare("SELECT image_path FROM receipts WHERE id = ?").get(id) as
    | { image_path: string | null }
    | undefined;

  if (!receipt?.image_path) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(receipt.image_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}