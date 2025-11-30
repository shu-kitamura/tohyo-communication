import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/common/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "TOHYO通信 ~Vote Communication~",
  description: "プレゼンテーションやイベントで使用するリアルタイム投票Webアプリケーション",
  twitter: {
    card: "summary_large_image",
    title: "TOHYO通信 ~Vote Communication~",
    description:
      "プレゼンやイベントで使えるリアルタイム投票Webアプリケーション",
    images: ["https://vote.shu-kita.net/twitter-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
