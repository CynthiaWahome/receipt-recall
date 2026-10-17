import { Suspense } from "react";
import UploadReceiptClient from "./UploadReceiptClient";

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-6 py-8 text-center">Loading...</div>}>
      <UploadReceiptClient />
    </Suspense>
  );
}
