'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import type { GameState, ActionType, Character } from '@/lib/types';
import CardDisplay from './CardDisplay';
import { sounds } from '@/lib/sounds';

interface Props {
  roomId: string;
  playerId: string;
  initialState: GameState;
  isOnline?: boolean;
}

const ACTION_LABELS: Record<ActionType, string> = {
  income: '収入 (1コイン)',
  foreign_aid: '外国援助 (2コイン)',
  coup: 'クーデター (7コイン)',
  tax: '徴収・将軍 (3コイン)',
  assassinate: '暗殺・刺客 (3コイン)',
  steal: '強奪・海賊 (2コイン盗む)',
  exchange: '探索・忍者',
};

const ACTION_DESC: Record<ActionType, string> = {
  income: '財務省から1コイン取る。妨害不可。',
  foreign_aid: '財務省から2コイン取る。将軍がいるとブロック可。',
  coup: '7コイン支払い、対象プレイヤーの影響力1つを除去。',
  tax: '将軍役を主張し、財務省から3コイン取る。',
  assassinate: '3コイン支払い、対象の影響力1つを除去。女王でブロック可。',
  steal: '海賊役を主張し、対象から2コイン盗む。忍者/海賊でブロック可。',
  exchange: '忍者役を主張し、山札から2枚引いてカードを交換する。',
};

const CHAR_LABELS: Record<Character, string> = {
  将軍: '将軍 (徴収・外国援助ブロック)',
  刺客: '刺客 (暗殺)',
  海賊: '海賊 (強奪・強奪ブロック)',
  忍者: '忍者 (探索・強奪ブロック)',
  女王: '女王 (暗殺ブロック)',
};

function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Coin base */}
      <circle cx="12" cy="12" r="11" fill="#d97706" />
      <circle cx="12" cy="12" r="11" stroke="#92400e" strokeWidth="0.8" />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="#78350f" strokeWidth="0.6" opacity="0.6" />
      {/* Star motif */}
      <polygon
        points="12,5.5 13.6,9.8 18.3,9.8 14.6,12.5 16.1,16.8 12,14.2 7.9,16.8 9.4,12.5 5.7,9.8 10.4,9.8"
        fill="#78350f"
        opacity="0.38"
      />
      {/* Light reflection */}
      <ellipse cx="8.5" cy="7.5" rx="2.8" ry="1.6" fill="white" opacity="0.18" transform="rotate(-20 8.5 7.5)" />
    </svg>
  );
}

function CoinBadge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-sm"
      style={{ background: 'rgba(120,53,15,0.4)', border: '1px solid rgba(180,83,9,0.5)', color: '#fbbf24' }}
    >
      <CoinIcon size={16} />
      {n}
    </span>
  );
}

export default function GameBoard({ roomId, playerId, initialState, isOnline }: Props) {
  const [state, setState] = useState<GameState>(initialState);
  // displayedPlayers is what's shown on the board for CPU cards.
  // It lags behind `state` while the ticker is playing so that card changes
  // are revealed in sync with the log rather than jumping to the final result.
  const [displayedPlayers, setDisplayedPlayers] = useState(initialState.players);
  const latestPlayersRef = useRef(initialState.players);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [ticker, setTicker] = useState<string>('');
  const [eventOverlay, setEventOverlay] = useState<{ text: string; kind: 'success' | 'fail' | 'elim' | 'victory' | 'neutral' } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [lobbyCpuCount, setLobbyCpuCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLogRef = useRef<string[]>([...initialState.log]);
  const tickerQueueRef = useRef<string[]>([]);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipElimRef = useRef(false); // set true when player presses skip after elimination
  const [skipRequested, setSkipRequested] = useState(false);
  const [elimSkipReady, setElimSkipReady] = useState(false); // delayed to prevent accidental tap
  const myNameRef = useRef(''); // tracked via ref so drainTickerQueue can read latest value

  function drainTickerQueue() {
    const next = tickerQueueRef.current.shift();
    if (!next) {
      setTicker('');
      setEventOverlay(null);
      tickerTimerRef.current = null;
      skipElimRef.current = false;
      setSkipRequested(false);
      setDisplayedPlayers(latestPlayersRef.current);
      return;
    }

    // Events mentioning the player directly, or known high-impact keywords → big event
    const isBigEvent =
      next.startsWith('✅') || next.startsWith('❌') ||
      /脱落|勝利|暗殺|クーデター|影響力-1/.test(next) ||
      (myNameRef.current !== '' && next.includes(myNameRef.current));

    // If player pressed "skip after elimination", fast-forward routine events.
    if (skipElimRef.current && !isBigEvent) {
      tickerTimerRef.current = setTimeout(drainTickerQueue, 150);
      return;
    }

    if (isBigEvent) {
      setTicker('');
      const kind: 'success' | 'fail' | 'elim' | 'victory' | 'neutral' =
        next.startsWith('✅') ? 'success'
        : next.startsWith('❌') ? 'fail'
        : /勝利/.test(next) ? 'victory'
        : /脱落|クーデター|暗殺/.test(next) ? 'elim'
        : 'neutral';
      setEventOverlay({ text: next, kind });
      const delay = /勝利/.test(next) ? 4500 : /脱落/.test(next) ? 5000 : 3200;
      tickerTimerRef.current = setTimeout(drainTickerQueue, delay);
    } else {
      setEventOverlay(null);
      setTicker(next);
      tickerTimerRef.current = setTimeout(drainTickerQueue, 2000);
    }
  }

  const me = state.players.find(p => p.id === playerId);
  myNameRef.current = me?.name ?? '';
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const pa = state.pendingAction;

  const poll = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/room/${roomId}`);
      if (res.ok) {
        const data: GameState = await res.json();
        // Only accept state that is at least as fresh as what we have locally
        // to prevent stale serverless responses from rewinding the game.
        setState(prev => (data.lastUpdated >= prev.lastUpdated ? data : prev));
      }
    } catch { /* silent */ }
  }, [roomId, isOnline]);

  useEffect(() => {
    if (isOnline) {
      pollRef.current = setInterval(poll, 1500);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [isOnline, poll]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  // useLayoutEffect: fires before paint so tickerActive is true before game-over screen can render
  useLayoutEffect(() => {
    latestPlayersRef.current = state.players;
    const prevLog = prevLogRef.current;
    const curLog = state.log;
    prevLogRef.current = [...curLog];
    let newEntries: string[];
    if (prevLog.length === 0) {
      newEntries = [...curLog];
    } else if (curLog.length > prevLog.length) {
      newEntries = curLog.slice(prevLog.length);
    } else {
      // Log hit the cap (same or shorter length): find new entries by locating
      // where the previous tail ends in the current log
      const prevLast = prevLog[prevLog.length - 1];
      let lastMatchIdx = -1;
      for (let i = curLog.length - 1; i >= 0; i--) {
        if (curLog[i] === prevLast) { lastMatchIdx = i; break; }
      }
      newEntries = lastMatchIdx >= 0 ? curLog.slice(lastMatchIdx + 1) : [];
    }
    if (newEntries.length === 0) {
      // No new log entries — update displayed cards immediately (e.g. lobby / init)
      setDisplayedPlayers(state.players);
      return;
    }
    tickerQueueRef.current.push(...newEntries);
    if (!tickerTimerRef.current) drainTickerQueue();
    // displayedPlayers will be updated when drainTickerQueue empties the queue
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.log]);

  // Delay the skip button by 2s after elimination to prevent accidental taps
  useEffect(() => {
    if (me && !me.isAlive && !isOnline) {
      const t = setTimeout(() => setElimSkipReady(true), 2000);
      return () => clearTimeout(t);
    } else {
      setElimSkipReady(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isAlive, isOnline]);

  const prevPhaseRef = useRef<string>('');
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = state.phase;
    if (prev === cur) return;
    prevPhaseRef.current = cur;
    if (cur === 'game_over') sounds.win();
    else if (cur === 'lose_influence') sounds.loseInfluence();
    else if (cur === 'resolving_challenge' || cur === 'resolving_block_challenge') sounds.challenge();
    else if (cur === 'waiting_block_reactions') sounds.block();
    else if (cur === 'action_select' && prev === 'lose_influence') sounds.coup();
  }, [state.phase]);

  async function sendAction(body: Record<string, unknown>) {
    sounds.buttonClick();
    setError('');
    try {
      // Always pass clientState as fallback for cold-start serverless instances
      const payload = { ...body, clientState: state };
      const res = await fetch(`/api/room/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'エラーが発生しました');
        return;
      }
      const data: GameState = await res.json();
      // Play sound based on action type
      const b = body as Record<string, string>;
      if (b.type === 'declare_action') {
        if (b.action === 'coup') sounds.coup();
        else if (b.action === 'income' || b.action === 'tax' || b.action === 'foreign_aid') sounds.coins();
        else sounds.action();
      } else if (b.type === 'react') {
        if (b.reaction === 'challenge') sounds.challenge();
        else if (b.reaction === 'block') sounds.block();
      }
      setState(data);
      setSelectedAction(null);
      setSelectedTarget(null);
      setSelectedCards([]);
    } catch {
      setError('Network error');
    }
  }

  function handleDeclareAction() {
    if (!selectedAction) return;
    const needsTarget = ['coup', 'assassinate', 'steal'].includes(selectedAction);
    if (needsTarget && !selectedTarget) {
      setError('ターゲットを選択してください');
      return;
    }
    sendAction({
      type: 'declare_action',
      playerId,
      action: selectedAction,
      targetId: selectedTarget ?? undefined,
    });
  }

  function handleReact(reaction: 'allow' | 'challenge' | 'block', blockChar?: Character) {
    sendAction({ type: 'react', playerId, reaction, blockCharacter: blockChar });
  }

  function handleBlockReact(reaction: 'challenge' | 'allow') {
    sendAction({ type: 'react_block', playerId, reaction });
  }

  function handleRevealForChallenge(cardId: string) {
    sendAction({ type: 'resolve_challenge', playerId, cardId });
  }

  function handleLoseInfluence(cardId: string) {
    sendAction({ type: 'lose_influence', playerId, cardId });
  }

  function handleExchange() {
    if (!pa?.exchangeDrawnCards) return;
    const handSize = me!.hand.length;
    if (selectedCards.length !== handSize) {
      setError(`${handSize}枚選択してください`);
      return;
    }
    sendAction({ type: 'exchange', playerId, keptCardIds: selectedCards });
  }

  function toggleCardSelect(id: string) {
    setSelectedCards(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const alive = state.players.filter(p => p.isAlive);
  void alive; // used in other contexts indirectly

  // Detect which non-me human the game is currently waiting for (for skip logic)
  const waitingForId = (() => {
    if (!pa) {
      if (state.phase === 'action_select' && !isMyTurn) {
        const cur = state.players[state.currentPlayerIndex];
        if (cur && !cur.isCPU) return cur.id;
      }
      return null;
    }
    if (state.phase === 'waiting_reactions') {
      const e = Object.entries(pa.reactions).find(([id, r]) => r === null && id !== playerId && !state.players.find(p => p.id === id)?.isCPU);
      return e?.[0] ?? null;
    }
    if (state.phase === 'waiting_block_reactions') {
      const e = Object.entries(pa.blockReactions).find(([id, r]) => r === null && id !== playerId && !state.players.find(p => p.id === id)?.isCPU);
      return e?.[0] ?? null;
    }
    if (state.phase === 'resolving_challenge' && pa.actorId !== playerId) {
      const p = state.players.find(pl => pl.id === pa.actorId);
      if (p && !p.isCPU) return pa.actorId;
    }
    if (state.phase === 'resolving_block_challenge' && pa.blockerId && pa.blockerId !== playerId) {
      const p = state.players.find(pl => pl.id === pa.blockerId);
      if (p && !p.isCPU) return pa.blockerId;
    }
    if (state.phase === 'lose_influence' && pa.currentLoseInfluenceEntry?.playerId !== playerId) {
      const pid = pa.currentLoseInfluenceEntry?.playerId;
      if (pid) { const p = state.players.find(pl => pl.id === pid); if (p && !p.isCPU) return pid; }
    }
    if (state.phase === 'exchange_select' && pa.actorId !== playerId) {
      const p = state.players.find(pl => pl.id === pa.actorId);
      if (p && !p.isCPU) return pa.actorId;
    }
    return null;
  })();
  const elapsedSec = Math.floor((Date.now() - state.lastUpdated) / 1000);
  const canSkip = isOnline && !!waitingForId && (
    (state.hostId === playerId && elapsedSec >= 30) || elapsedSec >= 90
  );

  // Determine what UI to show
  const myReaction = pa ? pa.reactions[playerId] : undefined;
  const myBlockReaction = pa ? pa.blockReactions[playerId] : undefined;
  const isWaitingMyReaction = state.phase === 'waiting_reactions' && playerId in (pa?.reactions ?? {}) && myReaction === null;
  const isWaitingMyBlockReaction = state.phase === 'waiting_block_reactions' && playerId in (pa?.blockReactions ?? {}) && myBlockReaction === null;

  // Human is the challenged player in either challenge phase:
  // - resolving_challenge: human is the actor whose action was challenged
  // - resolving_block_challenge: human is the blocker whose block was challenged
  const isChallengedPlayer = pa && (
    (state.phase === 'resolving_challenge' && pa.actorId === playerId) ||
    (state.phase === 'resolving_block_challenge' && pa.blockerId === playerId)
  );
  const isLoseInfluencePlayer = state.phase === 'lose_influence' && pa?.currentLoseInfluenceEntry?.playerId === playerId;
  const isExchangePlayer = state.phase === 'exchange_select' && pa?.actorId === playerId;

  // While the ticker / overlay is replaying events, always freeze the action panel
  // so the board and narrative stay in sync before the human is asked to act.
  const tickerActive = !!ticker || !!eventOverlay;
  // CPU戦で自分が脱落後、2秒待ってからスキップボタンを表示（誤タップ防止）
  const showElimSkip = elimSkipReady && !isOnline && me != null && !me.isAlive && tickerActive && !skipRequested;

  // Block options for my reaction
  const getBlockOptions = () => {
    if (!pa) return [];
    const { type, targetId, actorId } = pa;
    if (!['foreign_aid', 'assassinate', 'steal'].includes(type)) return [];
    if (type === 'foreign_aid' && playerId !== actorId) return ['将軍'] as Character[];
    if ((type === 'assassinate' || type === 'steal') && playerId === targetId) {
      if (type === 'assassinate') return ['女王'] as Character[];
      return ['忍者', '海賊'] as Character[];
    }
    return [];
  };

  const blockOptions = getBlockOptions();
  const canBlockAction = blockOptions.length > 0;

  if (state.phase === 'lobby') {
    const isHost = state.hostId === playerId;
    const joinUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/?join=${roomId}`
      : '';
    const humanCount = state.players.filter(p => !p.isCPU).length;
    const cpuOptions = Array.from({ length: 6 }, (_, i) => i).filter(n => humanCount + n >= 2 && humanCount + n <= 6);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#080503' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -8%, rgba(180,83,9,0.4) 0%, transparent 65%)' }} />
        <div className="relative z-10 text-center max-w-sm w-full">
          <div className="flex items-center mb-6">
            <a href="/" className="text-xs transition-colors" style={{ color: 'rgba(180,83,9,0.6)' }}>← 戻る</a>
            <h1 className="flex-1 font-black tracking-[0.2em]" style={{ fontSize: '1.8rem', color: '#f59e0b', textShadow: '0 0 24px rgba(217,119,6,0.6)' }}>謀略</h1>
          </div>
          <div className="rounded space-y-4 p-5" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)' }}>
            <h2 className="font-bold" style={{ color: 'rgba(217,180,120,0.9)' }}>ロビー — 参加者を待っています</h2>
            <div className="rounded p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(120,53,15,0.4)' }}>
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(180,83,9,0.6)' }}>ルームコード</p>
                <p className="text-4xl font-mono font-bold tracking-widest" style={{ color: '#fbbf24' }}>{roomId}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="w-full text-sm py-2 rounded transition-colors"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
              >
                コードをコピー
              </button>
              {joinUrl && (
                <button
                  onClick={() => navigator.clipboard.writeText(joinUrl)}
                  className="w-full text-sm py-2 rounded transition-colors"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
                >
                  参加URLをコピー
                </button>
              )}
              <p className="text-xs" style={{ color: 'rgba(120,53,15,0.7)' }}>友達はホームの「ルームに参加」からコードを入力</p>
            </div>
            <div className="space-y-2 text-left">
              <p className="text-xs" style={{ color: 'rgba(180,83,9,0.6)' }}>参加者 ({state.players.filter(p => !p.isCPU).length}人 / {state.players.length}枠)</p>
              {state.players.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(180,83,9,0.25)' }}>
                  <span style={{ color: 'rgba(74,222,128,0.7)' }}>◆</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
                  {p.id === state.hostId && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(180,83,9,0.5)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>ホスト</span>}
                  {p.isCPU && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(120,53,15,0.4)', color: 'rgba(180,83,9,0.7)' }}>CPU</span>}
                </div>
              ))}
            </div>
            {error && <p className="text-xs rounded p-2" style={{ color: '#fca5a5', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</p>}
            {isHost && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs block mb-2" style={{ color: 'rgba(217,180,120,0.55)' }}>CPUを追加（空きを自動補充）</label>
                  <div className="flex gap-2">
                    {cpuOptions.map(n => (
                      <button
                        key={n}
                        onClick={() => setLobbyCpuCount(n)}
                        className="flex-1 py-2 rounded text-sm font-bold transition-colors"
                        style={lobbyCpuCount === n
                          ? { background: 'rgba(180,83,9,0.75)', border: '1px solid rgba(251,191,36,0.4)', color: '#fff' }
                          : { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.3)', color: 'rgba(217,180,120,0.65)' }}
                      >
                        {n === 0 ? 'なし' : `+${n}`}
                      </button>
                    ))}
                  </div>
                  {lobbyCpuCount > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(120,53,15,0.7)' }}>合計 {humanCount + lobbyCpuCount}人でスタート</p>
                  )}
                </div>
                <button
                  onClick={() => sendAction({ type: 'start_game', playerId, cpuCount: lobbyCpuCount })}
                  className="w-full font-bold py-3 rounded transition-colors"
                  style={{ background: 'rgba(180,83,9,0.75)', border: '1px solid rgba(251,191,36,0.4)', color: '#fff' }}
                >
                  ゲーム開始
                </button>
              </div>
            )}
            {!isHost && <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>ホストがゲームを開始するのを待っています...</p>}
          </div>
        </div>
      </div>
    );
  }

  // Delay the result screen until the ticker/overlay has finished showing
  // the final events (elimination, victory). Once tickerActive becomes false
  // after the last ticker entry drains, this re-renders and shows the screen.
  if (state.phase === 'game_over' && !tickerActive) {
    const winner = state.players.find(p => p.id === state.winner);
    const iWon = state.winner === playerId;
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#080503' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(180,83,9,0.35) 0%, transparent 65%)' }} />
        <div className="relative z-10 text-center px-6 max-w-sm w-full">
          <div
            className="text-5xl mb-3 font-black tracking-widest"
            style={{ color: iWon ? '#fbbf24' : '#ef4444', textShadow: iWon ? '0 0 30px rgba(217,119,6,0.7)' : '0 0 30px rgba(239,68,68,0.5)' }}
          >
            {iWon ? '勝利' : '敗北'}
          </div>
          <p className="text-base mb-6" style={{ color: 'rgba(217,180,120,0.75)' }}>{winner?.name} の勝利！</p>
          <div className="mb-6 rounded p-4 text-left" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(180,83,9,0.3)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(180,83,9,0.7)' }}>ゲームログ</h2>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {state.log.map((l, i) => <div key={i} className="text-xs" style={{ color: 'rgba(217,180,120,0.55)' }}>{l}</div>)}
            </div>
          </div>
          <a
            href="/"
            className="block w-full font-bold py-3 rounded text-center"
            style={{ background: 'rgba(180,83,9,0.7)', border: '1px solid rgba(251,191,36,0.35)', color: '#fff' }}
          >
            ホームへ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#080503' }}>
      {/* Atmospheric top glow */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse 100% 35% at 50% 0%, rgba(180,83,9,0.22) 0%, transparent 60%)' }} />

      {/* Summary Modal */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowSummary(false)}
        >
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
            style={{ background: '#0d0a07', border: '1px solid rgba(180,83,9,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — outside scroll area so always visible */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,83,9,0.3)' }}>
              <h2 className="font-bold text-base tracking-wide" style={{ color: '#fbbf24' }}>ルール早見表</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="text-sm font-semibold px-3 py-1.5 rounded-full transition-colors"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
              >
                × 閉じる
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-5 text-sm">

              {/* General Actions */}
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

              {/* Character Actions */}
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

              {/* Counteractions */}
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

              {/* Challenge rules */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.6)' }}>チャレンジのルール</h3>
                <div className="rounded p-3 space-y-2 text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(120,53,15,0.3)', color: 'rgba(217,180,120,0.65)' }}>
                  <div className="flex gap-2"><span className="shrink-0" style={{ color: '#4ade80' }}>✓ 成功</span><span>チャレンジされた側がカードを見せた場合 → チャレンジした側が影響力を1つ失う。見せたカードはデッキに戻し新しいカードを引く</span></div>
                  <div className="flex gap-2"><span className="shrink-0" style={{ color: '#f87171' }}>✗ 失敗</span><span>カードを持っていなかった場合 → チャレンジされた側が影響力を1つ失い、アクション失敗（有料アクションはコイン返還）</span></div>
                  <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(120,53,15,0.3)' }}><span className="shrink-0" style={{ color: '#fbbf24' }}>⚠ 注意</span><span>暗殺にチャレンジして負けた場合、チャレンジ失敗の1つ＋暗殺の1つで計2影響力を失う可能性あり</span></div>
                </div>
              </section>

              {/* Influence */}
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
                onClick={() => setShowSummary(false)}
                className="w-full mt-2 font-semibold py-4 rounded text-base"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.35)', color: 'rgba(217,180,120,0.8)' }}
              >
                閉じる
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Routine action ticker — small banner at top */}
      {ticker && (
        <div className="fixed top-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div
            className="mt-2 mx-4 text-sm font-medium px-4 py-2 rounded shadow-lg max-w-sm w-full text-center"
            style={{ background: 'rgba(8,5,3,0.95)', border: '1px solid rgba(180,83,9,0.55)', color: 'rgba(253,230,138,0.9)' }}
          >
            {ticker}
          </div>
        </div>
      )}

      {/* Important event overlay — large centered card */}
      {eventOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6">
          <div
            className="w-full max-w-sm rounded px-5 py-5 shadow-2xl text-center"
            style={
              eventOverlay.kind === 'success'
                ? { background: 'rgba(6,78,59,0.95)', border: '2px solid rgba(52,211,153,0.7)', color: '#d1fae5' }
                : eventOverlay.kind === 'fail'
                ? { background: 'rgba(69,10,10,0.95)', border: '2px solid rgba(239,68,68,0.7)', color: '#fee2e2' }
                : eventOverlay.kind === 'elim'
                ? { background: 'rgba(20,10,5,0.97)', border: '2px solid rgba(185,28,28,0.7)', color: '#fecaca' }
                : eventOverlay.kind === 'victory'
                ? { background: 'rgba(66,32,6,0.97)', border: '2px solid rgba(251,191,36,0.8)', color: '#fef3c7' }
                : { background: 'rgba(8,5,3,0.95)', border: '2px solid rgba(180,83,9,0.7)', color: '#fde68a' }
            }
          >
            <p className="text-lg font-bold leading-snug">{eventOverlay.text}</p>
          </div>
        </div>
      )}

      {/* Skip button — appears after elimination while ticker is still playing */}
      {showElimSkip && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pb-10 pt-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <button
            className="pointer-events-auto text-base font-semibold px-8 py-3 rounded shadow-2xl"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(180,83,9,0.5)', color: 'rgba(217,180,120,0.85)' }}
            onClick={() => {
              // Cancel the current event's timer immediately
              if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
              // Find the victory event in the remaining queue (processCPUTurns
              // already ran to game_over so it should be there)
              const victoryEvent = tickerQueueRef.current.find(e => /🏆|勝利/.test(e));
              tickerQueueRef.current = [];
              setTicker('');
              skipElimRef.current = true;
              setSkipRequested(true);
              if (victoryEvent) {
                setEventOverlay({ text: victoryEvent, kind: 'victory' });
                tickerTimerRef.current = setTimeout(() => {
                  setEventOverlay(null);
                  tickerTimerRef.current = null;
                  skipElimRef.current = false;
                  setDisplayedPlayers(latestPlayersRef.current);
                }, 2000);
              } else {
                setEventOverlay(null);
                tickerTimerRef.current = null;
                skipElimRef.current = false;
                setDisplayedPlayers(latestPlayersRef.current);
              }
            }}
          >
            残りをスキップ →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 p-3 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(180,83,9,0.25)' }}>
        <div className="flex items-center gap-2">
          <a href="/" className="text-xs transition-colors" style={{ color: 'rgba(180,83,9,0.6)' }}>← ホーム</a>
          <h1 className="font-black tracking-[0.2em]" style={{ color: '#f59e0b', fontSize: '1.1rem', textShadow: '0 0 16px rgba(217,119,6,0.5)' }}>謀略</h1>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="text-xs px-2.5 py-1 rounded transition-colors"
          style={{ border: '1px solid rgba(180,83,9,0.4)', color: 'rgba(217,180,120,0.7)', background: 'rgba(0,0,0,0.3)' }}
        >
          ルール
        </button>
        <span className="text-sm flex items-center gap-2" style={{ color: 'rgba(217,180,120,0.8)' }}>
          <CoinBadge n={me?.coins ?? 0} /> {me?.name}
        </span>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Player List */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(180,83,9,0.6)' }}>プレイヤー</h2>
          {state.players.map(player => {
            const isMe = player.id === playerId;
            const displayPlayer = isMe
              ? player
              : (displayedPlayers.find(p => p.id === player.id) ?? player);
            const isCurrentTurn = state.players[state.currentPlayerIndex]?.id === player.id;
            const isElim = !displayPlayer.isAlive;
            return (
              <div
                key={player.id}
                className={`rounded relative p-3 ${isElim ? 'opacity-35' : ''}`}
                style={{
                  background: isCurrentTurn ? 'rgba(120,53,15,0.18)' : 'rgba(0,0,0,0.28)',
                  border: isCurrentTurn ? '1px solid rgba(245,158,11,0.55)' : '1px solid rgba(180,83,9,0.25)',
                  boxShadow: isCurrentTurn ? '0 0 16px rgba(180,83,9,0.12)' : undefined,
                }}
              >
                {/* Corner accents for active turn */}
                {isCurrentTurn && !isElim && (
                  <>
                    <span className="absolute top-[-1px] left-[-1px] w-3 h-3 border-t-2 border-l-2 border-amber-400/60 pointer-events-none" />
                    <span className="absolute top-[-1px] right-[-1px] w-3 h-3 border-t-2 border-r-2 border-amber-400/60 pointer-events-none" />
                    <span className="absolute bottom-[-1px] left-[-1px] w-3 h-3 border-b-2 border-l-2 border-amber-400/60 pointer-events-none" />
                    <span className="absolute bottom-[-1px] right-[-1px] w-3 h-3 border-b-2 border-r-2 border-amber-400/60 pointer-events-none" />
                  </>
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: isCurrentTurn ? '#fde68a' : 'rgba(255,255,255,0.9)' }}>{player.name}</span>
                    {isMe && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(29,78,216,0.55)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd' }}>
                        あなた
                      </span>
                    )}
                    {player.isCPU && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(120,53,15,0.4)', color: 'rgba(180,83,9,0.7)' }}>
                        CPU
                      </span>
                    )}
                    {isCurrentTurn && !isElim && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(180,83,9,0.5)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24' }}>
                        ターン中
                      </span>
                    )}
                    {isElim && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(127,29,29,0.5)', border: '1px solid rgba(239,68,68,0.35)', color: 'rgba(252,165,165,0.8)' }}>
                        脱落
                      </span>
                    )}
                  </div>
                  <CoinBadge n={displayPlayer.coins} />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {displayPlayer.hand.map((card) => (
                    <div key={card.id}>
                      {isMe ? (
                        <CardDisplay character={card.character} small />
                      ) : (
                        <CardDisplay faceDown small />
                      )}
                    </div>
                  ))}
                  {displayPlayer.revealed.map(card => (
                    <CardDisplay key={card.id} character={card.character} small dead />
                  ))}
                  {isMyTurn && !isMe && player.isAlive && selectedAction && ['coup', 'assassinate', 'steal'].includes(selectedAction) && (
                    <button
                      onClick={() => setSelectedTarget(player.id)}
                      className="px-2.5 py-1.5 text-xs rounded font-semibold transition-colors"
                      style={selectedTarget === player.id
                        ? { background: 'rgba(185,28,28,0.7)', border: '1px solid rgba(239,68,68,0.6)', color: '#fca5a5' }
                        : { background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(239,68,68,0.35)', color: 'rgba(252,165,165,0.7)' }}
                    >
                      {selectedTarget === player.id ? '◆ 選択中' : 'ターゲット'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          {/* Action Panel */}
          <div className="rounded p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.3)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(180,83,9,0.6)' }}>アクション</h2>

            {error && (
              <div className="text-sm mb-2 px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            {tickerActive ? (
              <p className="text-sm text-center py-2" style={{ color: 'rgba(180,83,9,0.5)' }}>◆ 確認中...</p>
            ) : (<></> /* render action panel normally below */)}
            {!tickerActive && (<>

            {/* My turn: select action */}
            {isMyTurn && state.phase === 'action_select' && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold mb-2" style={{ color: '#fbbf24' }}>あなたのターンです</p>
                {(['income', 'foreign_aid', 'coup', 'tax', 'assassinate', 'steal', 'exchange'] as ActionType[]).map(action => {
                  const canAfford = action === 'coup' ? (me?.coins ?? 0) >= 7
                    : action === 'assassinate' ? (me?.coins ?? 0) >= 3
                    : true;
                  const mustCoupNow = (me?.coins ?? 0) >= 10;
                  if (mustCoupNow && action !== 'coup') return null;
                  const isSelected = selectedAction === action;
                  return (
                    <div key={action}>
                      <button
                        disabled={!canAfford}
                        onClick={() => { setSelectedAction(action); setSelectedTarget(null); }}
                        className="w-full relative text-left px-3 py-2 rounded text-sm transition-colors"
                        style={isSelected
                          ? { background: 'rgba(180,83,9,0.5)', border: '1px solid rgba(245,158,11,0.6)', color: '#fde68a' }
                          : canAfford
                          ? { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(180,83,9,0.3)', color: 'rgba(217,180,120,0.8)' }
                          : { background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(75,85,99,0.3)', color: 'rgba(107,114,128,0.6)', cursor: 'not-allowed' }
                        }
                      >
                        {ACTION_LABELS[action]}
                      </button>
                      {isSelected && (
                        <p className="text-xs px-2 py-1" style={{ color: 'rgba(180,83,9,0.65)' }}>{ACTION_DESC[action]}</p>
                      )}
                    </div>
                  );
                })}
                {selectedAction && (
                  <button
                    onClick={handleDeclareAction}
                    className="w-full mt-1 font-bold py-2.5 rounded text-sm transition-colors"
                    style={{ background: 'rgba(180,83,9,0.75)', border: '1px solid rgba(251,191,36,0.4)', color: '#fff' }}
                  >
                    実行する ◆
                  </button>
                )}
              </div>
            )}

            {/* Not my turn: waiting */}
            {!isMyTurn && state.phase === 'action_select' && (
              <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>{currentPlayer?.name} のターン...</p>
            )}

            {/* Reaction panel */}
            {isWaitingMyReaction && pa && (
              <div className="space-y-2">
                <div className="rounded p-3" style={{ background: 'rgba(120,53,15,0.25)', border: '1px solid rgba(245,158,11,0.4)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#fbbf24' }}>
                    ◆ {state.players.find(p => p.id === pa.actorId)?.name} が宣言：
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {ACTION_LABELS[pa.type]}
                    {pa.targetId === playerId && <span className="ml-1" style={{ color: '#fca5a5' }}>（あなたが対象！）</span>}
                    {pa.targetId && pa.targetId !== playerId && (
                      <span className="ml-1 text-xs" style={{ color: 'rgba(217,180,120,0.7)' }}>
                        → {state.players.find(p => p.id === pa.targetId)?.name}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleReact('allow')}
                  className="w-full py-3 rounded text-sm font-semibold"
                  style={{ background: 'rgba(21,128,61,0.55)', border: '1px solid rgba(74,222,128,0.35)', color: '#86efac' }}
                >
                  許可する
                </button>
                {pa.claimedCharacter && (
                  <button
                    onClick={() => handleReact('challenge')}
                    className="w-full py-3 rounded text-sm font-semibold"
                    style={{ background: 'rgba(185,28,28,0.55)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
                  >
                    チャレンジ（{pa.claimedCharacter}を持っていない？）
                  </button>
                )}
                {canBlockAction && blockOptions.map(char => (
                  <button
                    key={char}
                    onClick={() => handleReact('block', char)}
                    className="w-full py-3 rounded text-sm font-semibold"
                    style={{ background: 'rgba(29,78,216,0.5)', border: '1px solid rgba(96,165,250,0.35)', color: '#93c5fd' }}
                  >
                    {char}でブロック
                  </button>
                ))}
              </div>
            )}

            {/* Waiting for others to react */}
            {state.phase === 'waiting_reactions' && !isWaitingMyReaction && (
              <div>
                <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>他プレイヤーの反応を待っています...</p>
                {pa && (() => {
                  const pendingNames = Object.entries(pa.reactions)
                    .filter(([, r]) => r === null)
                    .map(([id]) => state.players.find(p => p.id === id)?.name ?? id)
                    .join('、');
                  return (
                    <p className="text-xs mt-1" style={{ color: 'rgba(245,158,11,0.7)' }}>
                      待機中: {pendingNames || '（なし）'}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Block reaction */}
            {isWaitingMyBlockReaction && pa && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                  {state.players.find(p => p.id === pa.blockerId)?.name} が {pa.blockerClaimedCharacter} でブロック！
                </p>
                <button
                  onClick={() => handleBlockReact('allow')}
                  className="w-full py-2 rounded text-sm font-semibold"
                  style={{ background: 'rgba(21,128,61,0.55)', border: '1px solid rgba(74,222,128,0.35)', color: '#86efac' }}
                >
                  ブロックを受け入れる
                </button>
                <button
                  onClick={() => handleBlockReact('challenge')}
                  className="w-full py-2 rounded text-sm font-semibold"
                  style={{ background: 'rgba(185,28,28,0.55)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
                >
                  チャレンジ ({pa.blockerClaimedCharacter}を持っていない?)
                </button>
              </div>
            )}

            {state.phase === 'waiting_block_reactions' && !isWaitingMyBlockReaction && (
              <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>ブロックへの反応を待っています...</p>
            )}

            {/* Challenge resolution: show your card */}
            {isChallengedPlayer && me && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>チャレンジされました！カードを選んで提示してください</p>
                <div className="flex gap-2 flex-wrap">
                  {me.hand.map(card => (
                    <div key={card.id} onClick={() => handleRevealForChallenge(card.id)} className="cursor-pointer">
                      <CardDisplay character={card.character} small />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lose influence */}
            {isLoseInfluencePlayer && me && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>影響力を1つ失います。カードを選んでください</p>
                <div className="flex gap-2 flex-wrap">
                  {me.hand.map(card => (
                    <div key={card.id} onClick={() => handleLoseInfluence(card.id)} className="cursor-pointer">
                      <CardDisplay character={card.character} small />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exchange */}
            {isExchangePlayer && me && pa?.exchangeDrawnCards && (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                  {me.hand.length}枚選んで手札にする (残りは返却)
                </p>
                <p className="text-xs" style={{ color: 'rgba(180,83,9,0.6)' }}>選択中: {selectedCards.length}/{me.hand.length}</p>
                <div className="flex gap-2 flex-wrap">
                  {[...me.hand, ...pa.exchangeDrawnCards].map(card => (
                    <div key={card.id} onClick={() => toggleCardSelect(card.id)} className="cursor-pointer">
                      <CardDisplay character={card.character} small selected={selectedCards.includes(card.id)} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExchange}
                  className="w-full py-2 rounded text-sm font-semibold"
                  style={{ background: 'rgba(180,83,9,0.7)', border: '1px solid rgba(251,191,36,0.4)', color: '#fff' }}
                >
                  交換確定
                </button>
              </div>
            )}

            {/* Waiting states */}
            {(state.phase === 'resolving_challenge' || state.phase === 'resolving_block_challenge') && !isChallengedPlayer && (
              <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>チャレンジを解決中...</p>
            )}
            {state.phase === 'lose_influence' && !isLoseInfluencePlayer && (
              <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>
                {state.players.find(p => p.id === pa?.currentLoseInfluenceEntry?.playerId)?.name} が影響力を選んでいます...
              </p>
            )}
            {state.phase === 'exchange_select' && !isExchangePlayer && (
              <p className="text-sm" style={{ color: 'rgba(180,83,9,0.55)' }}>忍者 が探索を選んでいます...</p>
            )}
            {/* Disconnection skip button */}
            {waitingForId && isOnline && (
              <div className="mt-2 text-center">
                <p className="text-xs" style={{ color: 'rgba(75,85,99,0.8)' }}>
                  {state.players.find(p => p.id === waitingForId)?.name} を待っています ({elapsedSec}秒)
                </p>
                {canSkip && (
                  <button
                    onClick={() => sendAction({ type: 'skip_player', playerId, targetPlayerId: waitingForId })}
                    className="mt-1 text-xs px-2 py-1 rounded transition-colors"
                    style={{ border: '1px solid rgba(185,28,28,0.5)', color: '#fca5a5' }}
                  >
                    切断? スキップする
                  </button>
                )}
              </div>
            )}
            </>)}
          </div>

          {/* Game Log */}
          <div className="rounded p-4" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(180,83,9,0.2)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(180,83,9,0.5)' }}>ゲームログ</h2>
            <div ref={logRef} className="max-h-48 overflow-y-auto space-y-0.5">
              {state.log.map((l, i) => (
                <p key={i} className="text-xs" style={{ color: 'rgba(217,180,120,0.5)' }}>{l}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
