'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import type { LobbyEntry } from '@/lib/types';

const RANDOM_NAMES = [
  'スパイ', '詐欺師', '公爵', '暗殺者', '船長', '大使', '伯爵', '革命家',
  '策略家', '陰謀家', 'ブラフ王', '影の支配者', '謀略家', '権力者',
];
function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="6" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="7" cy="7" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function LobbyInner() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LobbyEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [name, setName] = useState('');
  const [pendingRoom, setPendingRoom] = useState<LobbyEntry | null>(null);
  const [password, setPassword] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [placeholder] = useState(randomName);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/lobby');
      if (res.ok) setRooms(await res.json());
    } catch { /* silent */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 3000);
    return () => clearInterval(t);
  }, [fetchRooms]);

  async function doJoin(roomId: string, pw?: string) {
    const playerName = name.trim() || placeholder;
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, password: pw ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました');
        setJoining(false);
        return;
      }
      router.push(`/r/${roomId}?pid=${data.playerId}&online=1`);
    } catch {
      setError('接続エラーが発生しました');
      setJoining(false);
    }
  }

  function handleRoomTap(room: LobbyEntry) {
    setError('');
    if (room.hasPassword) {
      setPendingRoom(room);
      setPassword('');
    } else {
      doJoin(room.id);
    }
  }

  function handleCodeJoin() {
    const code = codeInput.trim().toUpperCase();
    if (!code) { setError('ルームコードを入力してください'); return; }
    doJoin(code);
  }

  const inputCls = 'w-full px-3 py-2.5 rounded text-white text-sm border focus:outline-none focus:border-amber-600/70 transition-colors';
  const inputStyle = { background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(180,83,9,0.4)', color: '#fff' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080503' }}>
      {/* Spotlight */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(180,83,9,0.28) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 w-full max-w-sm mx-auto px-5 pt-8 pb-12 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-xs px-3 py-1.5 rounded shrink-0"
            style={{ color: 'rgba(180,83,9,0.8)', border: '1px solid rgba(180,83,9,0.3)', background: 'rgba(0,0,0,0.3)' }}
          >
            ← 戻る
          </button>
          <h1 className="font-bold text-lg" style={{ color: '#fbbf24' }}>参加待ちルーム</h1>
        </div>

        {/* Name */}
        <div>
          <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>
            あなたの名前（空欄でランダム）
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        {/* Room list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: 'rgba(180,83,9,0.7)' }}>
              オープンルーム
            </span>
            <span className="text-xs" style={{ color: 'rgba(120,53,15,0.6)' }}>3秒ごとに更新</span>
          </div>

          {loadingList ? (
            <div className="py-10 text-center text-xs" style={{ color: 'rgba(120,53,15,0.6)' }}>
              読み込み中...
            </div>
          ) : rooms.length === 0 ? (
            <div
              className="py-10 text-center rounded"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.25)' }}
            >
              <p className="text-sm mb-1" style={{ color: 'rgba(180,120,60,0.7)' }}>参加待ちのルームがありません</p>
              <p className="text-xs" style={{ color: 'rgba(120,53,15,0.55)' }}>ルームを作成して友達を招待しよう</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => handleRoomTap(room)}
                  disabled={joining}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-colors disabled:opacity-50 group"
                  style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(180,83,9,0.4)' }}
                >
                  {/* Lock / globe icon */}
                  <span
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full"
                    style={{
                      background: room.hasPassword ? 'rgba(120,53,15,0.3)' : 'rgba(30,58,138,0.3)',
                      color: room.hasPassword ? '#f59e0b' : '#60a5fa',
                    }}
                  >
                    {room.hasPassword ? <LockIcon /> : <GlobeIcon />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {room.hostName} のルーム
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(180,83,9,0.6)' }}>
                      参加中 {room.playerCount} 人
                      {room.hasPassword && <span className="ml-2" style={{ color: 'rgba(245,158,11,0.6)' }}>🔒 パスワード有</span>}
                    </div>
                  </div>

                  <span
                    className="shrink-0 text-xs font-bold px-3 py-1.5 rounded"
                    style={{ background: 'rgba(180,83,9,0.4)', color: '#fbbf24', border: '1px solid rgba(180,83,9,0.55)' }}
                  >
                    参加
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(120,53,15,0.35)' }} />
          <span className="text-xs" style={{ color: 'rgba(120,53,15,0.5)' }}>またはコードで参加</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(120,53,15,0.35)' }} />
        </div>

        {/* Direct code join */}
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ルームコード (例: A1B2C3)"
            className={`${inputCls} font-mono tracking-widest text-center`}
            style={inputStyle}
            onKeyDown={e => e.key === 'Enter' && handleCodeJoin()}
          />
          <button
            onClick={handleCodeJoin}
            disabled={joining}
            className="px-4 rounded font-bold text-sm shrink-0 disabled:opacity-50"
            style={{ background: 'rgba(21,128,61,0.7)', color: '#fff', border: '1px solid rgba(74,222,128,0.35)' }}
          >
            →
          </button>
        </div>

        {error && <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>}
      </div>

      {/* Password modal */}
      {pendingRoom && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => { setPendingRoom(null); setError(''); }}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 space-y-4"
            style={{ background: '#0d0a07', border: '1px solid rgba(180,83,9,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h2 className="font-bold text-base mb-1" style={{ color: '#fbbf24' }}>🔒 パスワードを入力</h2>
              <p className="text-xs" style={{ color: 'rgba(217,180,120,0.5)' }}>
                {pendingRoom.hostName} のルームはパスワードで保護されています
              </p>
            </div>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="パスワード"
              autoFocus
              className={inputCls}
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && doJoin(pendingRoom.id, password)}
            />
            {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setPendingRoom(null); setError(''); }}
                className="flex-1 py-2.5 rounded text-sm"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.4)', color: 'rgba(217,180,120,0.7)' }}
              >
                キャンセル
              </button>
              <button
                onClick={() => doJoin(pendingRoom.id, password)}
                disabled={joining || !password}
                className="flex-1 py-2.5 rounded font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(180,83,9,0.75)', color: '#fff', border: '1px solid rgba(251,191,36,0.3)' }}
              >
                {joining ? '参加中...' : '参加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense>
      <LobbyInner />
    </Suspense>
  );
}
