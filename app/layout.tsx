import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VersionBanner from "@/components/VersionBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 公開ドメイン。vercel.app のURLを入れると canonical と og:url が
// 実際に配信しているホストと食い違うため、カスタムドメインを使う。
const BASE_URL = 'https://bouryaku.boardgamecat.com';

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
  // このサブドメインはゲーム本体で、クローラーが読める本文がほとんどない
  // （サーバー側描画のテキストは十数文字）。審査対象ドメイン boardgamecat.com に
  // 本文のないページを並べることになり、AdSense の
  // 「screens without publisher-content」に当たるため検索インデックスから外す。
  // 説明文を持つ正規のページは https://boardgamecat.com/games/coup 側。
  // follow は残し、トップへ戻るリンクの評価は渡す。
  robots: {
    index: false,
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
      </body>
    </html>
  );
}
