import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex flex-1 w-full max-w-4xl flex-col items-center justify-between py-24 px-6 sm:items-start">
        <div className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left">
          <Image
            src="/icon.svg"
            alt="ReceiptRecall logo"
            width={64}
            height={64}
            priority
            className="mx-auto sm:mx-0"
          />
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground">
              ReceiptRecall
            </h1>
            <p className="mt-4 text-lg sm:text-xl leading-relaxed text-muted-foreground">
              Your receipts. A better memory.
            </p>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              Turn photographed grocery receipts into a corrected, saved purchase history with unit-price
              comparison. Private, local-first, open weights.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row w-full max-w-md">
            <Link
              href="/receipts/new"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-primary-foreground font-medium transition-colors hover:bg-primary/90"
            >
              Scan Receipt
            </Link>
            <Link
              href="/history"
              className="flex h-12 w-full items-center justify-center rounded-lg border border-border px-6 font-medium transition-colors hover:bg-muted"
            >
              View History
            </Link>
          </div>
        </div>
        <div className="mt-16 w-full">
          <Image
            src="/docs/assets/readme-banner.svg"
            alt="ReceiptRecall — Your receipts. A better memory."
            width={1600}
            height={560}
            className="w-full h-auto rounded-lg border border-border"
          />
        </div>
      </main>
      <footer className="w-full max-w-4xl px-6 py-8 text-center text-sm text-muted-foreground">
        <p>
          Built for dev.to Week 2 Side Hustle — Open Innovation track.{" "}
          <a href="https://github.com/CynthiaWahome/receipt-recall" className="underline hover:text-primary">
            Source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}