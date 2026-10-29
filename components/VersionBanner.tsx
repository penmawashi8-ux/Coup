'use client';
import { useCallback, useRef, useState } from 'react';
import { usePolling } from '@/lib/use-polling';

// 新しいバージョンが出ていないかの確認間隔。
//
// 90秒おきにしていたので、開いているタブ1つあたり1時間40回。
// 更新はめったに出ないのに、CDNリクエストの無料枠（月100万回）を
// 遊んでいる全員ぶん削っていた。30分あれば十分で、
// 画面が隠れている間は usePolling が止めてくれる。
const CHECK_INTERVAL_MS = 30 * 60_000;

export default function VersionBanner() {
  const [show, setShow] = useState(false);
  const knownVersion = useRef<string | null>(null);

  const check = useCallback(async () => {
    if (show) return; // 一度気づいたらもう確認しなくてよい
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = await res.json() as { version: string };
      if (knownVersion.current === null) {
        knownVersion.current = version;
      } else if (knownVersion.current !== version) {
        setShow(true);
      }
    } catch { /* ignore network errors */ }
  }, [show]);

  usePolling(check, CHECK_INTERVAL_MS);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="bg-gray-900 border border-amber-500 text-white rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 pointer-events-auto max-w-sm w-full">
        <span className="text-sm flex-1">新しいバージョンが利用できます</span>
        <button
          onClick={() => window.location.reload()}
          className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold px-3 py-1.5 rounded-lg shrink-0"
        >
          更新
        </button>
        <button
          onClick={() => setShow(false)}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
