import { Suspense } from "react";
import ManualReceiptClient from "./ManualReceiptClient";

export default function ManualReceiptPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-6 py-8 text-center">Loading...</div>}>
      <ManualReceiptClient />
    </Suspense>
  );
}
