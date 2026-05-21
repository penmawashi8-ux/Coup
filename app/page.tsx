'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import CoupHeroImage from '@/components/CoupHeroImage';

const RANDOM_NAMES = [
  'スパイ', '詐欺師', '公爵', '大使', '伯爵', '革命家',
  '策略家', '陰謀家', 'ブラフ王', '影の支配者', '謀略家', '権力者',
  '怪盗', '錬金術師', '道化師', '占い師', '賭博師',
  '傭兵', '外交官', '黒幕', '影武者', '商人',
  '幻術師', '賢者', '情報屋', '密売人', '監察官',
  '金融家', '貴族', '議員', '密偵',
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

function IconBook() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 5.5 C7 4.5 10 4.5 13 5.5 L13 21.5 C10 20.5 7 20.5 4 21.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M22 5.5 C19 4.5 16 4.5 13 5.5 L13 21.5 C16 20.5 19 20.5 22 21.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
  const [mode, setMode] = useState<'menu' | 'cpu' | 'online_create'>('menu');
  const [showRules, setShowRules] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [name, setName] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [skipTimeoutSec, setSkipTimeoutSec] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect legacy ?join= share links straight to the lobby page
    const join = searchParams.get('join');
    if (join) router.push(`/lobby`);
  }, [searchParams, router]);

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
      password: roomPassword.trim() || undefined,
      skipTimeoutSec: skipTimeoutSec > 0 ? skipTimeoutSec : undefined,
    });
    setLoading(false);
    if (!ok) { setError(data.error ?? 'エラーが発生しました'); return; }
    if (data.lobbyError) {
      // Show error for diagnostics, but still allow entering the room
      setError(`[診断] ロビー登録失敗: ${data.lobbyError}`);
      // Navigate anyway after a short delay so error is visible
      setTimeout(() => router.push(`/r/${data.roomId}?pid=${data.playerId}&online=1`), 4000);
      return;
    }
    router.push(`/r/${data.roomId}?pid=${data.playerId}&online=1`);
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
            謀略
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
              onClick={() => router.push('/lobby')}
              icon={<IconDoor />}
              label="ルームに参加"
              sub="参加待ちのルームを探す"
            />
            <MenuButton
              onClick={() => setShowRules(true)}
              icon={<IconBook />}
              label="ルールを見る"
              sub="キャラクターとアクションの一覧"
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
            <div>
              <label className="block mb-1.5 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>パスワード（省略可）</label>
              <input
                value={roomPassword}
                onChange={e => setRoomPassword(e.target.value)}
                type="password"
                placeholder="設定しない場合は空欄"
                className={inputCls}
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: 'rgba(120,53,15,0.6)' }}>
                設定するとロビーで 🔒 が表示されます
              </p>
            </div>
            <div>
              <label className="block mb-2 text-xs" style={{ color: 'rgba(217,180,120,0.6)' }}>放置スキップ時間</label>
              <div className="grid grid-cols-4 gap-2">
                {([15, 30, 60, 0] as const).map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSkipTimeoutSec(sec)}
                    className="py-2.5 rounded text-sm font-bold transition-colors"
                    style={skipTimeoutSec === sec
                      ? { background: '#d97706', color: '#000' }
                      : { background: 'rgba(0,0,0,0.4)', color: 'rgba(217,180,120,0.6)', border: '1px solid rgba(120,53,15,0.4)' }}
                  >
                    {sec === 0 ? '∞' : `${sec}秒`}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: 'rgba(120,53,15,0.6)' }}>
                {skipTimeoutSec > 0 ? `無操作が${skipTimeoutSec}秒続くと自動でターンをスキップ` : 'スキップなし（手動のみ）'}
              </p>
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

      </div>

      {/* Rules modal */}
      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowRules(false)}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
            style={{ background: '#0d0a07', border: '1px solid rgba(180,83,9,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,83,9,0.3)' }}>
              <h2 className="font-bold text-base tracking-wide" style={{ color: '#fbbf24' }}>ルール早見表</h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-sm font-semibold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
              >
                × 閉じる
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-5 text-sm">

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>ゲームの進め方</h3>
                <div className="space-y-2 text-xs" style={{ color: 'rgba(217,180,120,0.7)' }}>
                  <div className="rounded p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)' }}>
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>準備</p>
                    <p>各プレイヤーは伏せカード2枚（影響力）と2コインを受け取ってスタート。</p>
                  </div>
                  <div className="rounded p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)' }}>
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>自分のターン</p>
                    <p>アクションを1つ宣言する。キャラクターアクションは実際にそのカードを持っていなくても宣言できる（ブラフOK）。</p>
                    <p style={{ color: 'rgba(245,158,11,0.8)' }}>⚠ コインが10枚以上あるときはクーデター必須。</p>
                  </div>
                  <div className="rounded p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)' }}>
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>他プレイヤーの反応</p>
                    <div className="space-y-1.5">
                      <p><span style={{ color: '#f87171' }}>チャレンジ</span> — 「そのキャラ持ってないだろ」と疑う。チャレンジされた側がカードを公開して証明。</p>
                      <p className="pl-3" style={{ color: 'rgba(180,180,180,0.6)' }}>・本物を見せた → チャレンジした側が影響力-1、見せたカードは引き直し</p>
                      <p className="pl-3" style={{ color: 'rgba(180,180,180,0.6)' }}>・持っていなかった → 宣言した側が影響力-1、アクション失敗</p>
                      <p><span style={{ color: '#93c5fd' }}>ブロック</span> — 対応するキャラを主張してアクションを妨害。ブロック自体もチャレンジできる。</p>
                    </div>
                  </div>
                  <div className="rounded p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)' }}>
                    <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>脱落と勝利</p>
                    <p className="mt-1">カードを2枚とも公開させられたプレイヤーは脱落。<span style={{ color: '#fbbf24' }}>最後に残った1人が勝利。</span></p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>一般アクション（常に使用可）</h3>
                <div className="space-y-1">
                  {[
                    { name: '収入', cost: '', effect: '財務省から 1コイン取る', block: '×', challenge: '×' },
                    { name: '外国援助', cost: '', effect: '財務省から 2コイン取る', block: '将軍', challenge: '×' },
                    { name: 'クーデター', cost: '7◆', effect: '対象の影響力1つを強制除去（必ず成功）', block: '×', challenge: '×' },
                  ].map(a => (
                    <div key={a.name} className="rounded px-3 py-2 flex gap-3 items-start" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)' }}>
                      <div className="min-w-[80px]">
                        <span className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{a.name}</span>
                        {a.cost && <span className="text-xs ml-1" style={{ color: '#fbbf24' }}>{a.cost}</span>}
                      </div>
                      <div className="flex-1 text-xs" style={{ color: 'rgba(217,180,120,0.65)' }}>{a.effect}</div>
                      <div className="text-right text-xs space-y-0.5 shrink-0">
                        <div style={{ color: a.block === '×' ? 'rgba(75,85,99,0.7)' : '#93c5fd' }}>B: {a.block}</div>
                        <div style={{ color: a.challenge === '×' ? 'rgba(75,85,99,0.7)' : '#fca5a5' }}>⚔ {a.challenge}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>キャラクターアクション（チャレンジされる可能性あり）</h3>
                <div className="space-y-1">
                  {[
                    { char: '将軍', bg: 'rgba(88,28,135,0.4)', border: 'rgba(147,51,234,0.4)', symbol: '★', action: '徴収', cost: '', effect: '財務省から 3コイン取る', block: '—' },
                    { char: '刺客', bg: 'rgba(30,27,30,0.5)', border: 'rgba(113,113,122,0.4)', symbol: '☠', action: '暗殺', cost: '3◆', effect: '対象の影響力1つを除去', block: '女王（対象のみ）' },
                    { char: '海賊', bg: 'rgba(30,58,138,0.4)', border: 'rgba(59,130,246,0.4)', symbol: '⚓', action: '強奪', cost: '', effect: '対象から 2コイン盗む（1枚以下なら全部）', block: '忍者 / 海賊（対象のみ）' },
                    { char: '忍者', bg: 'rgba(120,53,15,0.35)', border: 'rgba(245,158,11,0.45)', symbol: '✦', action: '探索', cost: '', effect: '山札から2枚引いて、手札と好きに交換し余った2枚を戻す', block: '—' },
                  ].map(a => (
                    <div key={a.char} className="rounded px-3 py-2" style={{ background: a.bg, border: `1px solid ${a.border}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{a.symbol}</span>
                        <span className="font-bold text-sm text-white">{a.char}</span>
                        <span className="font-semibold text-xs" style={{ color: 'rgba(217,180,120,0.75)' }}>→ {a.action}</span>
                        {a.cost && <span className="text-xs" style={{ color: '#fbbf24' }}>{a.cost}</span>}
                      </div>
                      <p className="text-xs ml-6" style={{ color: 'rgba(217,180,120,0.65)' }}>{a.effect}</p>
                      {a.block !== '—' && <p className="text-xs ml-6 mt-0.5" style={{ color: '#93c5fd' }}>ブロック: {a.block}</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>ブロック（カウンターアクション）</h3>
                <div className="rounded overflow-hidden" style={{ border: '1px solid rgba(120,53,15,0.35)' }}>
                  {[
                    { blocker: '将軍 ★', blocks: '外国援助', who: '誰でも', color: '#c084fc' },
                    { blocker: '女王 ♛', blocks: '暗殺', who: '対象プレイヤーのみ', color: '#f87171' },
                    { blocker: '忍者 ✦', blocks: '強奪', who: '対象プレイヤーのみ', color: '#fbbf24' },
                    { blocker: '海賊 ⚓', blocks: '強奪', who: '対象プレイヤーのみ', color: '#60a5fa' },
                  ].map((b, i) => (
                    <div key={b.blocker + b.blocks} className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.25)', borderTop: i > 0 ? '1px solid rgba(120,53,15,0.2)' : undefined }}>
                      <span className="font-semibold min-w-[120px] text-xs" style={{ color: b.color }}>{b.blocker}</span>
                      <span className="text-xs" style={{ color: 'rgba(120,53,15,0.7)' }}>が</span>
                      <span className="font-semibold text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{b.blocks}</span>
                      <span className="text-xs ml-auto" style={{ color: 'rgba(120,53,15,0.65)' }}>{b.who}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>チャレンジのルール</h3>
                <div className="rounded p-3 space-y-2 text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)', color: 'rgba(217,180,120,0.65)' }}>
                  <div className="flex gap-2"><span className="shrink-0" style={{ color: '#4ade80' }}>✓ 成功</span><span>チャレンジされた側がカードを見せた場合 → チャレンジした側が影響力を1つ失う。見せたカードはデッキに戻し新しいカードを引く</span></div>
                  <div className="flex gap-2"><span className="shrink-0" style={{ color: '#f87171' }}>✗ 失敗</span><span>カードを持っていなかった場合 → チャレンジされた側が影響力を1つ失い、アクション失敗（有料アクションはコイン返還）</span></div>
                  <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(120,53,15,0.3)' }}><span className="shrink-0" style={{ color: '#fbbf24' }}>⚠ 注意</span><span>暗殺にチャレンジして負けた場合、チャレンジ失敗の1つ＋暗殺の1つで計2影響力を失う可能性あり</span></div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>影響力・勝利条件</h3>
                <div className="rounded p-3 space-y-1 text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)', color: 'rgba(217,180,120,0.65)' }}>
                  <p>各プレイヤーは2枚の伏せカード（影響力）を持つ</p>
                  <p>影響力を失うたびにカードを1枚公開する</p>
                  <p>2枚とも公開されたプレイヤーは脱落</p>
                  <p className="font-semibold" style={{ color: '#fbbf24' }}>最後に残った1人が勝利</p>
                </div>
              </section>

              <button
                onClick={() => setShowRules(false)}
                className="w-full mt-2 font-semibold py-4 rounded text-base"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
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
