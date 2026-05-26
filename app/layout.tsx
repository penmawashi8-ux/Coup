import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VersionBanner from "@/components/VersionBanner";
import BackToTopButton from "@/components/BackToTopButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = 'https://bouryaku-two.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: '謀略 | ブラフ × 心理戦カードゲーム',
    template: '%s | 謀略',
  },
  description:
    '将軍・刺客・海賊・忍者・女王の5キャラで読み合うブラフカードゲーム。嘘をつき、見破り、最後の1人になれ。2〜6人対応。CPU対戦・オンライン対戦が無料で遊べる。',
  keywords: ['謀略', 'ブラフゲーム', 'カードゲーム', 'Coup', '心理戦', 'オンラインゲーム', 'CPU対戦', 'ボードゲーム'],
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: '謀略',
    title: '謀略 | ブラフ × 心理戦カードゲーム',
    description:
      '将軍・刺客・海賊・忍者・女王の5キャラで読み合うブラフカードゲーム。嘘をつき、見破り、最後の1人になれ。CPU対戦・オンライン対戦が無料で遊べる。',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: '謀略 | ブラフ × 心理戦カードゲーム',
    description: '将軍・刺客・海賊・忍者・女王の5キャラで読み合うブラフカードゲーム。CPU対戦・オンライン対戦が無料で遊べる。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <VersionBanner />
        <BackToTopButton />
      </body>
    </html>
  );
}
