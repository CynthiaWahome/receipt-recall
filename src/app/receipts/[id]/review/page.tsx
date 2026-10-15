import { Suspense } from "react";
import ReviewReceiptClient from "./ReviewReceiptClient";

export default function ReviewReceiptPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-6 py-8 text-center">Loading...</div>}>
      <ReviewReceiptClient />
    </Suspense>
  );
}