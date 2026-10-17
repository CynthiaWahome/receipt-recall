"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadReceiptClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a receipt photo first.");
      return;
    }
    setError("");
    setUploading(true);

    try {
      const body = new FormData();
      body.append("photo", file);

      const res = await fetch("/api/receipts", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // Land on the review screen, which runs OCR + AI extraction.
      router.push(`/receipts/${data.id}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setUploading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Scan a receipt</h1>
      <p className="text-muted-foreground mb-6">
        Take or choose a photo of a printed receipt. We read it with OCR and a local AI model,
        then let you check every item before saving. Your photo is processed on this server, not a
        third-party service.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
      )}

      <form onSubmit={handleUpload} className="space-y-6">
        <label
          htmlFor="photo"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center cursor-pointer hover:border-primary"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected receipt preview" className="max-h-80 w-auto rounded-lg border border-gray-200" />
          ) : (
            <>
              <span className="text-4xl" aria-hidden>📷</span>
              <span className="font-medium">Tap to take a photo or choose one</span>
              <span className="text-sm text-muted-foreground">Photo from your phone (JPEG, PNG or HEIC), up to 8 MB</span>
            </>
          )}
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>

        {file && (
          <p className="text-sm text-muted-foreground">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading…" : "Upload and read receipt"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Receipt faint or unreadable?{" "}
        <Link href="/receipts/manual" className="underline hover:text-primary">
          Enter it manually instead
        </Link>
        .
      </p>
    </main>
  );
}
