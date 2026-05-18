'use client';
import { useEffect, useRef, useState } from 'react';

export default function VersionBanner() {
  const [show, setShow] = useState(false);
  const knownVersion = useRef<string | null>(null);

  useEffect(() => {
    async function check() {
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
    }

    check();
    const id = setInterval(check, 90_000); // every 90 s
    return () => clearInterval(id);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="bg-gray-900 border border-amber-500 text-white rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 pointer-events-auto max-w-sm w-full">
        <span className="text-sm flex-1">🆕 新しいバージョンが利用できます</span>
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
