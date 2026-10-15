import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReceiptRecall — Your receipts. A better memory.",
  description: "Turn photographed grocery receipts into a corrected, saved purchase history with unit-price comparison. Private, local-first, open weights.",
  metadataBase: new URL("https://receipts.cynthiawahome.com"),
  openGraph: {
    title: "ReceiptRecall — Your receipts. A better memory.",
    description: "Turn photographed grocery receipts into a corrected, saved purchase history with unit-price comparison.",
    type: "website",
    locale: "en_US",
    siteName: "ReceiptRecall",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReceiptRecall — Your receipts. A better memory.",
    description: "Turn photographed grocery receipts into a corrected, saved purchase history with unit-price comparison.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}