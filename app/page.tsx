'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import CoupHeroImage from '@/components/CoupHeroImage';

const RANDOM_NAMES = [
  'スパイ', '詐欺師', '公爵', '暗殺者', '船長', '大使', '伯爵', '革命家',
  '策略家', '陰謀家', 'ブラフ王', '影の支配者', '謀略家', '権力者',
];

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

async function apiPost(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, string> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: Record<string, string> = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { ok: res.ok, data };
}

function IconSwords() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="3" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="3" x2="3" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="7" x2="7" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="3" x2="23" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="13" r="2.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function IconPlayers() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2,22 C2,17.6 5.1,14 9,14 C12.9,14 16,17.6 16,22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <path d="M15,22 C15.5,18.8 16.6,16.5 18,15.5 C19.4,14.5 21,14.8 22,16 C23,17.2 24,19.2 24,22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="3" width="14" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="13" r="1.5" fill="currentColor" />
      <path d="M13,13 L20,13 M17,10 L20,13 L17,16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuButton({ onClick, icon, label, sub }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full relative group flex items-center gap-4 px-5 py-4 transition-colors"
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(180,83,9,0.55)',
      }}
    >
      {/* Corner marks */}
      <span className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-amber-500/70 pointer-events-none" />
      <span className="absolute top-[-1px] right-[-1px] w-3 h-3 border-t-2 border-r-2 border-amber-500/70 pointer-events-none" />
      <span className="absolute bottom-[-1px] left-[-1px] w-3 h-3 border-b-2 border-l-2 border-amber-500/70 pointer-events-none" />
      <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-amber-500/70 pointer-events-none" />
      {/* Hover overlay */}
      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: 'rgba(180,83,9,0.08)' }} />

      <span className="text-amber-600/80 shrink-0 relative z-10">{icon}</span>
      <span className="flex-1 text-left relative z-10">
        <span className="block font-bold text-base text-amber-200/90 tracking-wide">{label}</span>
        <span className="block text-xs mt-0.5" style={{ color: 'rgba(180,83,9,0.75)' }}>{sub}</span>
      </span>
      <span className="text-amber-800/60 text-xs relative z-10">◆</span>
    </button>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'menu' | 'cpu' | 'online_create' | 'online_join'>('menu');
  const [name, setName] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const join = searchParams.get('join');
    if (join) {
      setMode('online_join');
      setRoomCode(join.toUpperCase());
    }
  }, [searchParams]);

  function resolvedName() {
    return name.trim() || randomName();
  }

  async function startCPUGame() {
    setLoading(true);
    setError('');
    const cpuCount = totalPlayers - 1;
    const { ok, data } = await apiPost('/api/room', {
      playerName: resolvedName(),
      cpuCount,
      mode: 'cpu',
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? 'エラーが発生しました'); return; }
    router.push(`/r/${data.roomId}?pid=${data.playerId}`);
  }

  async function createOnlineRoom() {
    setLoading(true);
    setError('');
    const { ok, data } = await apiPost('/api/room', {
      playerName: resolvedName(),
      mode: 'online',
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? 'エラーが発生しました'); return; }
    router.push(`/r/${data.roomId}?pid=${data.playerId}&online=1`);
  }

  async function joinOnlineRoom() {
    if (!roomCode.trim()) { setError('ルームコードを入力してください'); return; }
    setLoading(true);
    setError('');
    const code = roomCode.trim().toUpperCase();
    const { ok, data } = await apiPost(`/api/room/${code}/join`, {
      playerName: resolvedName(),
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? 'エラーが発生しました'); return; }
    router.push(`/r/${code}?pid=${data.playerId}&online=1`);
  }

  const PLAYER_OPTIONS = [2, 3, 4, 5, 6];

  const inputCls = "w-full px-3 py-2.5 rounded text-white text-sm border focus:outline-none focus:border-amber-600/70 transition-colors";
  const inputStyle = { background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(180,83,9,0.4)', color: '#fff' };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#080503' }}>

      {/* Spotlight beam */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 55% at 50% -8%, rgba(180,83,9,0.45) 0%, rgba(120,53,15,0.15) 40%, transparent 65%)',
      }} />

      <div className="relative z-10 w-full max-w-sm px-5 flex flex-col items-center"
        style={{ paddingTop: mode === 'menu' ? '2rem' : '1.5rem', paddingBottom: '2rem' }}>

        {/* ── MENU ── */}
        {mode === 'menu' && (<>
          {/* Hero card */}
          <div style={{ transform: 'rotate(-6deg)', marginBottom: '1.5rem' }}>
            <CoupHeroImage />
          </div>

          {/* Title */}
          <h1
            className="font-black tracking-[0.25em] leading-none"
            style={{
              fontSize: '3.4rem',
              color: '#f59e0b',
              textShadow: '0 0 32px rgba(217,119,6,0.7), 0 0 70px rgba(180,83,9,0.35)',
            }}
          >
            謀・略
          </h1>

          {/* Subtitle */}
          <div className="flex items-center w-full gap-3 mt-3 mb-8">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(180,83,9,0.6))' }} />
            <p className="text-xs tracking-widest whitespace-nowrap" style={{ color: 'rgba(180,83,9,0.75)' }}>
              ブラフと心理戦のカードゲーム
            </p>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(180,83,9,0.6))' }} />
          </div>

          {/* Buttons */}
          <div className="w-full space-y-3">
            <MenuButton
              onClick={() => { setMode('cpu'); setTotalPlayers(2); }}
              icon={<IconSwords />}
              label="CPU対戦"
              sub="AIと心理戦を繰り広げる"
            />
            <MenuButton
              onClick={() => setMode('online_create')}
              icon={<IconPlayers />}
              label="オンライン対戦（ルーム作成）"
              sub="オンラインで他のプレイヤーと対戦"
            />
            <MenuButton
              onClick={() => setMode('online_join')}
              icon={<IconDoor />}
              label="ルームに参加"
              sub="招待されたルームに参加する"
            />
          </div>

          {/* Description */}
          <div className="mt-5 w-full p-4 rounded text-sm"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.35)' }}>
            <h3 className="font-semibold mb-1.5 text-amber-600/80 text-xs tracking-wider uppercase">ゲームについて</h3>
            <p className="leading-relaxed" style={{ color: 'rgba(217,180,120,0.65)', fontSize: '0.78rem' }}>
              謀略は2〜6人のブラフゲームです。キャラクターカードを使い、相手の影響力をすべて除去した最後の1人が勝者。嘘をついても、読み合っても、すべてはあなたの選択次第。
            </p>
          </div>
        </>)}

        {/* ── CPU MODE ── */}
        {mode === 'cpu' && (
          <div className="w-full space-y-5 rounded p-6"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)' }}>
            <button onClick={() => setMode('menu')} className="text-xs" style={{ color: 'rgba(180,83,9,0.7)' }}>← 戻る</button>
            <h2 className="font-bold text-lg" style={{ color: '#f59e0b' }}>CPU対戦</h2>

            <div>
              <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block mb-2 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>プレイヤー総数（CPU含む）</label>
              <div className="grid grid-cols-5 gap-2">
                {PLAYER_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalPlayers(n)}
                    className="py-2.5 rounded text-sm font-bold transition-colors"
                    style={totalPlayers === n
                      ? { background: '#d97706', color: '#000' }
                      : { background: 'rgba(0,0,0,0.4)', color: 'rgba(217,180,120,0.6)', border: '1px solid rgba(120,53,15,0.4)' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'rgba(120,53,15,0.8)' }}>あなた1人 + CPU {totalPlayers - 1}体</p>
            </div>

            {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
            <button
              onClick={startCPUGame}
              disabled={loading}
              className="w-full font-bold py-3 rounded transition-colors disabled:opacity-50"
              style={{ background: 'rgba(180,83,9,0.8)', color: '#fff', border: '1px solid rgba(251,191,36,0.4)' }}
            >
              {loading ? '準備中...' : 'ゲーム開始'}
            </button>
          </div>
        )}

        {/* ── ONLINE CREATE ── */}
        {mode === 'online_create' && (
          <div className="w-full space-y-5 rounded p-6"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)' }}>
            <button onClick={() => setMode('menu')} className="text-xs" style={{ color: 'rgba(180,83,9,0.7)' }}>← 戻る</button>
            <h2 className="font-bold text-lg" style={{ color: '#f59e0b' }}>オンラインルーム作成</h2>
            <div className="p-3 rounded text-sm" style={{ background: 'rgba(30,58,138,0.2)', border: '1px solid rgba(30,64,175,0.4)', color: 'rgba(147,197,253,0.8)' }}>
              ルームを作ってコードを友達に共有。開始時に人数が足りなければCPUが自動補充されます。
            </div>
            <div>
              <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
            <button
              onClick={createOnlineRoom}
              disabled={loading}
              className="w-full font-bold py-3 rounded transition-colors disabled:opacity-50"
              style={{ background: 'rgba(29,78,216,0.7)', color: '#fff', border: '1px solid rgba(96,165,250,0.35)' }}
            >
              {loading ? '準備中...' : 'ルーム作成'}
            </button>
          </div>
        )}

        {/* ── ONLINE JOIN ── */}
        {mode === 'online_join' && (
          <div className="w-full space-y-5 rounded p-6"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)' }}>
            <button onClick={() => setMode('menu')} className="text-xs" style={{ color: 'rgba(180,83,9,0.7)' }}>← 戻る</button>
            <h2 className="font-bold text-lg" style={{ color: '#f59e0b' }}>ルームに参加</h2>
            <div>
              <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>ルームコード</label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="例: A1B2C3"
                className={`${inputCls} font-mono text-2xl tracking-widest text-center`}
                style={inputStyle}
              />
            </div>
            {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
            <button
              onClick={joinOnlineRoom}
              disabled={loading}
              className="w-full font-bold py-3 rounded transition-colors disabled:opacity-50"
              style={{ background: 'rgba(21,128,61,0.7)', color: '#fff', border: '1px solid rgba(74,222,128,0.35)' }}
            >
              {loading ? '参加中...' : '参加する'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
