import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "tamheed-tasks.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = new URL(`${protocol}://${host}`);

  return {
    metadataBase: base,
    title: "المهام اليومية",
    description: "صفحة تسجيل المهام اليومية.",
    icons: {
      icon: "https://tamheed.sa/wp-content/uploads/2025/12/logo.svg",
      shortcut: "https://tamheed.sa/wp-content/uploads/2025/12/logo.svg",
    },
    openGraph: {
      title: "المهام اليومية",
      description: "صفحة تسجيل المهام اليومية.",
      type: "website",
      locale: "ar_SA",
      images: [new URL("/og.png", base).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title: "المهام اليومية",
      description: "صفحة تسجيل المهام اليومية.",
      images: [new URL("/og.png", base).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
