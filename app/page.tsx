'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'menu' | 'cpu' | 'online_create' | 'online_join'>('menu');
  const [name, setName] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(2); // CPU mode: total including self
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
    router.push(`/game/${data.roomId}?pid=${data.playerId}`);
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
    router.push(`/game/${data.roomId}?pid=${data.playerId}&online=1`);
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
    router.push(`/game/${code}?pid=${data.playerId}&online=1`);
  }

  const PLAYER_OPTIONS = [2, 3, 4, 5, 6];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-black tracking-widest text-amber-400 mb-2">COUP</h1>
          <p className="text-gray-400 text-sm">ブラフとチャレンジの心理戦</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('cpu'); setTotalPlayers(2); }}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              🤖 CPU対戦
            </button>
            <button
              onClick={() => setMode('online_create')}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              🌐 オンライン対戦（ルーム作成）
            </button>
            <button
              onClick={() => setMode('online_join')}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              🔗 ルームに参加
            </button>
            <div className="mt-4 p-4 bg-gray-800 rounded-lg text-sm text-gray-400">
              <h3 className="text-gray-300 font-semibold mb-1">ゲームについて</h3>
              <p>Coupは2〜6人のブラフゲームです。キャラクターカードを使い、相手の影響力をすべて除去した最後の1人が勝者。嘘をついても、チャレンジされなければ成功します。</p>
            </div>
          </div>
        )}

        {mode === 'cpu' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-5">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">CPU対戦</h2>

            {/* Name */}
            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Total players selector */}
            <div>
              <label className="text-gray-300 text-sm block mb-2">プレイヤー総数（CPU含む）</label>
              <div className="grid grid-cols-5 gap-2">
                {PLAYER_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => setTotalPlayers(n)}
                    className={`py-3 rounded-xl text-lg font-bold transition-colors ${
                      totalPlayers === n
                        ? 'bg-amber-500 text-black'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-2">あなた1人 + CPU {totalPlayers - 1}体</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={startCPUGame}
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? '準備中...' : 'ゲーム開始'}
            </button>
          </div>
        )}

        {mode === 'online_create' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-5">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">オンラインルーム作成</h2>
            <div className="p-3 bg-blue-900/40 border border-blue-600 rounded-lg text-sm text-blue-200">
              ルームを作ってコードを友達に共有。ゲーム開始時に人数が足りなければCPUが自動補充されます。
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={createOnlineRoom}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? '準備中...' : 'ルーム作成'}
            </button>
          </div>
        )}

        {mode === 'online_join' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-5">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">ルームに参加</h2>

            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前（空欄でランダム）</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={randomName()}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm block mb-1">ルームコード</label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="例: A1B2C3"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400 font-mono text-2xl tracking-widest text-center"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={joinOnlineRoom}
              disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
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
