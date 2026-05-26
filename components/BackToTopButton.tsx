'use client';
import { useState, useEffect } from 'react';

export default function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-5 z-50 w-11 h-11 flex items-center justify-center rounded-full font-bold text-lg"
      style={{
        background: 'rgba(180,83,9,0.9)',
        border: '1px solid rgba(251,191,36,0.5)',
        color: '#fbbf24',
        boxShadow: '0 2px 16px rgba(0,0,0,0.6)',
      }}
      aria-label="トップへ戻る"
    >
      ↑
    </button>
  );
}
