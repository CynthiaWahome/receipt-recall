import { Suspense } from "react";
import NewReceiptClient from "./NewReceiptClient";

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-6 py-8 text-center">Loading...</div>}>
      <NewReceiptClient />
    </Suspense>
  );
}