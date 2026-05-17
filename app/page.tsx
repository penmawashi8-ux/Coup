'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'menu' | 'cpu' | 'online_create' | 'online_join'>('menu');
  const [name, setName] = useState('');
  const [cpuCount, setCpuCount] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(2);

  useEffect(() => {
    const join = searchParams.get('join');
    if (join) {
      setMode('online_join');
      setRoomCode(join.toUpperCase());
    }
  }, [searchParams]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCPUGame() {
    if (!name.trim()) { setError('名前を入力してください'); return; }
    if (cpuCount < 1) { setError('CPU対戦には最低1CPUが必要です'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, cpuCount, totalPlayers: cpuCount + 1 }),
      });
      const data = await res.json();
      router.push(`/game/${data.roomId}?pid=${data.playerId}`);
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  async function createOnlineRoom() {
    if (!name.trim()) { setError('名前を入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, mode: 'online' }),
      });
      const data = await res.json();
      router.push(`/game/${data.roomId}?pid=${data.playerId}&online=1`);
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  async function joinOnlineRoom() {
    if (!name.trim()) { setError('名前を入力してください'); return; }
    if (!roomCode.trim()) { setError('ルームコードを入力してください'); return; }
    setLoading(true);
    setError('');
    try {
      const code = roomCode.trim().toUpperCase();
      const res = await fetch(`/api/room/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'エラー');
        return;
      }
      const data = await res.json();
      router.push(`/game/${code}?pid=${data.playerId}&online=1`);
    } catch {
      setError('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

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
              onClick={() => setMode('cpu')}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              🤖 CPU対戦
            </button>
            <button
              onClick={() => { setMode('online_create'); setCpuCount(0); setTotalPlayers(2); }}
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
            <div className="mt-6 p-4 bg-gray-800 rounded-lg text-sm text-gray-400">
              <h3 className="text-gray-300 font-semibold mb-1">ゲームについて</h3>
              <p>Coupは2〜6人のブラフゲームです。キャラクターカードを使い、相手の影響力をすべて除去した最後の1人が勝者。嘘をついても、チャレンジされなければ成功します。</p>
            </div>
          </div>
        )}

        {mode === 'cpu' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">CPU対戦</h2>
            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="プレイヤー名"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">CPUプレイヤー数 (1〜5)</label>
              <input
                type="number" min={1} max={5} value={cpuCount}
                onChange={e => setCpuCount(Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={startCPUGame}
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? '作成中...' : 'ゲーム開始'}
            </button>
          </div>
        )}

        {mode === 'online_create' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">オンラインルーム作成</h2>
            <div className="p-3 bg-blue-900/40 border border-blue-600 rounded-lg text-sm text-blue-200">
              ルームを作ってコードを友達に共有。ゲーム開始時に人数が足りなければCPUが自動補充されます。
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="プレイヤー名"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={createOnlineRoom}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? '作成中...' : 'ルーム作成'}
            </button>
          </div>
        )}

        {mode === 'online_join' && (
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <button onClick={() => setMode('menu')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
            <h2 className="text-white font-bold text-xl">ルームに参加</h2>
            <div>
              <label className="text-gray-300 text-sm block mb-1">あなたの名前</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="プレイヤー名"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">ルームコード</label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="例: A1B2C3"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-400 font-mono text-lg tracking-widest"
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
