'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  tax: '徴収・奉行 (3コイン)',
  assassinate: '暗殺・忍者 (3コイン)',
  steal: '強奪・盗賊 (2コイン盗む)',
  exchange: '探索・密偵',
};

const ACTION_DESC: Record<ActionType, string> = {
  income: '財務省から1コイン取る。妨害不可。',
  foreign_aid: '財務省から2コイン取る。奉行がいるとブロック可。',
  coup: '7コイン支払い、対象プレイヤーの影響力1つを除去。',
  tax: '奉行役を主張し、財務省から3コイン取る。',
  assassinate: '3コイン支払い、対象の影響力1つを除去。姫でブロック可。',
  steal: '盗賊役を主張し、対象から2コイン盗む。密偵/盗賊でブロック可。',
  exchange: '密偵役を主張し、Court山から2枚引いてカードを交換する。',
};

const CHAR_LABELS: Record<Character, string> = {
  奉行: '奉行 (徴収・外国援助ブロック)',
  忍者: '忍者 (暗殺)',
  盗賊: '盗賊 (強奪・強奪ブロック)',
  密偵: '密偵 (探索・強奪ブロック)',
  姫: '姫 (暗殺ブロック)',
};

function coin(n: number) {
  return `💰${n}`;
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
  const [eventOverlay, setEventOverlay] = useState<{ text: string; kind: 'success' | 'fail' | 'elim' | 'neutral' } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [lobbyCpuCount, setLobbyCpuCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLogLenRef = useRef(initialState.log.length);
  const tickerQueueRef = useRef<string[]>([]);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function drainTickerQueue() {
    const next = tickerQueueRef.current.shift();
    if (!next) {
      setTicker('');
      setEventOverlay(null);
      tickerTimerRef.current = null;
      setDisplayedPlayers(latestPlayersRef.current);
      return;
    }

    // Route important events to the center overlay; routine events to the small top ticker.
    const isBigEvent =
      next.startsWith('✅') || next.startsWith('❌') ||
      /脱落|🏆|勝利|暗殺|クーデター/.test(next);

    if (isBigEvent) {
      setTicker('');
      const kind: 'success' | 'fail' | 'elim' | 'neutral' =
        next.startsWith('✅') ? 'success'
        : next.startsWith('❌') ? 'fail'
        : /脱落|クーデター|暗殺/.test(next) ? 'elim'
        : 'neutral';
      setEventOverlay({ text: next, kind });
      tickerTimerRef.current = setTimeout(drainTickerQueue, 2800);
    } else {
      setEventOverlay(null);
      setTicker(next);
      tickerTimerRef.current = setTimeout(drainTickerQueue, 1600);
    }
  }

  const me = state.players.find(p => p.id === playerId);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const pa = state.pendingAction;

  const poll = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/room/${roomId}`);
      if (res.ok) {
        const data: GameState = await res.json();
        setState(data);
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

  // Queue new log entries for the ticker; keep displayed cards in sync
  useEffect(() => {
    latestPlayersRef.current = state.players;
    const newEntries = state.log.slice(prevLogLenRef.current);
    prevLogLenRef.current = state.log.length;
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

  // While the ticker / overlay is replaying CPU actions, freeze the action panel
  // so it doesn't jump ahead to the next turn before the player sees what happened.
  // Exception: if the human must act RIGHT NOW (lose influence, reveal card, exchange)
  // always show those panels immediately.
  const humanMustActNow = isLoseInfluencePlayer || isChallengedPlayer || isExchangePlayer ||
    isWaitingMyReaction || isWaitingMyBlockReaction || (isMyTurn && state.phase === 'action_select');
  const tickerActive = !!ticker || !!eventOverlay;

  // Block options for my reaction
  const getBlockOptions = () => {
    if (!pa) return [];
    const { type, targetId, actorId } = pa;
    if (!['foreign_aid', 'assassinate', 'steal'].includes(type)) return [];
    if (type === 'foreign_aid' && playerId !== actorId) return ['奉行'] as Character[];
    if ((type === 'assassinate' || type === 'steal') && playerId === targetId) {
      if (type === 'assassinate') return ['姫'] as Character[];
      return ['密偵', '盗賊'] as Character[];
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="flex items-center mb-6">
            <a href="/" className="text-gray-400 hover:text-white text-sm">← 戻る</a>
            <h1 className="text-4xl font-black text-amber-400 flex-1">COUP</h1>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-white font-bold text-xl">ロビー — 参加者を待っています</h2>
            <div className="bg-black/40 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-gray-400 text-xs mb-1">ルームコード</p>
                <p className="text-amber-400 text-4xl font-mono font-bold tracking-widest">{roomId}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 rounded-lg"
              >
                コードをコピー
              </button>
              {joinUrl && (
                <button
                  onClick={() => navigator.clipboard.writeText(joinUrl)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 rounded-lg"
                >
                  参加URLをコピー
                </button>
              )}
              <p className="text-gray-500 text-xs">友達はホームの「ルームに参加」からコードを入力</p>
            </div>
            <div className="space-y-2 text-left">
              <p className="text-gray-400 text-sm">参加者 ({state.players.filter(p => !p.isCPU).length}人 / {state.players.length}枠)</p>
              {state.players.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-gray-700 rounded px-3 py-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-white">{p.name}</span>
                  {p.id === state.hostId && <span className="text-xs bg-amber-600 px-1 rounded">ホスト</span>}
                  {p.isCPU && <span className="text-xs bg-gray-600 px-1 rounded">CPU</span>}
                </div>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm bg-red-900/30 rounded p-2">{error}</p>}
            {isHost && (
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-2">CPUを追加（空きを自動補充）</label>
                  <div className="flex gap-2">
                    {cpuOptions.map(n => (
                      <button
                        key={n}
                        onClick={() => setLobbyCpuCount(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                          lobbyCpuCount === n
                            ? 'bg-amber-500 text-black'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {n === 0 ? 'なし' : `+${n}`}
                      </button>
                    ))}
                  </div>
                  {lobbyCpuCount > 0 && (
                    <p className="text-gray-500 text-xs mt-1">合計 {humanCount + lobbyCpuCount}人でスタート</p>
                  )}
                </div>
                <button
                  onClick={() => sendAction({ type: 'start_game', playerId, cpuCount: lobbyCpuCount })}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl"
                >
                  ゲーム開始
                </button>
              </div>
            )}
            {!isHost && <p className="text-gray-400 text-sm">ホストがゲームを開始するのを待っています...</p>}
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'game_over') {
    const winner = state.players.find(p => p.id === state.winner);
    const iWon = state.winner === playerId;
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">{iWon ? '🏆' : '💀'}</div>
          <h1 className="text-4xl font-bold text-white mb-2">{iWon ? '勝利！' : 'ゲームオーバー'}</h1>
          <p className="text-xl text-gray-300 mb-8">{winner?.name} の勝利！</p>
          <div className="mb-8">
            <h2 className="text-white font-semibold mb-2">ゲームログ</h2>
            <div className="bg-black/40 rounded p-4 max-h-48 overflow-y-auto text-sm text-gray-300 text-left">
              {state.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
          <a href="/" className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold">
            ホームへ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Summary Modal */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header — outside scroll area so always visible */}
            <div className="shrink-0 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-amber-400 font-bold text-lg">ルール早見表</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full"
              >
                × 閉じる
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-5 text-sm">

              {/* General Actions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">一般アクション（常に使用可）</h3>
                <div className="space-y-1">
                  {[
                    { name: '収入', cost: '', effect: '財務省から 1コイン取る', block: '×', challenge: '×' },
                    { name: '外国援助', cost: '', effect: '財務省から 2コイン取る', block: '奉行', challenge: '×' },
                    { name: 'クーデター', cost: '7💰', effect: '対象の影響力1つを強制除去（必ず成功）', block: '×', challenge: '×', note: '10コイン以上は必ずこれ' },
                  ].map(a => (
                    <div key={a.name} className="bg-gray-800 rounded-lg px-3 py-2 flex gap-3 items-start">
                      <div className="min-w-[80px]">
                        <span className="text-white font-semibold">{a.name}</span>
                        {a.cost && <span className="text-amber-400 text-xs ml-1">{a.cost}</span>}
                      </div>
                      <div className="flex-1 text-gray-300">{a.effect}</div>
                      <div className="text-right text-xs space-y-0.5 shrink-0">
                        <div className={a.block === '×' ? 'text-gray-600' : 'text-blue-400'}>🛡 {a.block}</div>
                        <div className={a.challenge === '×' ? 'text-gray-600' : 'text-red-400'}>⚔ {a.challenge}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Character Actions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">キャラクターアクション（チャレンジされる可能性あり）</h3>
                <div className="space-y-1">
                  {[
                    { char: '奉行', color: 'bg-purple-900 border-purple-600', symbol: '★', action: '徴収', cost: '', effect: '財務省から 3コイン取る', block: '—', challenge: '可' },
                    { char: '忍者', color: 'bg-gray-800 border-gray-500', symbol: '☠', action: '暗殺', cost: '3💰', effect: '対象の影響力1つを除去', block: '姫（対象のみ）', challenge: '可' },
                    { char: '盗賊', color: 'bg-blue-900 border-blue-600', symbol: '⚓', action: '強奪', cost: '', effect: '対象から 2コイン盗む（1枚以下なら全部）', block: '密偵 / 盗賊（対象のみ）', challenge: '可' },
                    { char: '密偵', color: 'bg-amber-900 border-amber-600', symbol: '◆', action: '探索', cost: '', effect: 'Court山から2枚引いて、手札と好きに交換し2枚返す', block: '—', challenge: '可' },
                  ].map(a => (
                    <div key={a.char} className={`rounded-lg border px-3 py-2 ${a.color}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{a.symbol}</span>
                        <span className="text-white font-bold">{a.char}</span>
                        <span className="text-gray-300 font-semibold">→ {a.action}</span>
                        {a.cost && <span className="text-amber-400 text-xs">{a.cost}</span>}
                      </div>
                      <p className="text-gray-300 text-xs ml-7">{a.effect}</p>
                      {a.block !== '—' && <p className="text-blue-300 text-xs ml-7 mt-0.5">🛡 ブロック: {a.block}</p>}
                    </div>
                  ))}
                </div>
              </section>

              {/* Counteractions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">ブロック（カウンターアクション）</h3>
                <div className="bg-gray-800 rounded-lg divide-y divide-gray-700">
                  {[
                    { blocker: '奉行 ★', blocks: '外国援助', who: '誰でも', color: 'text-purple-400' },
                    { blocker: '姫 ♛', blocks: '暗殺', who: '対象プレイヤーのみ', color: 'text-red-400' },
                    { blocker: '密偵 ◆', blocks: '強奪', who: '対象プレイヤーのみ', color: 'text-amber-400' },
                    { blocker: '盗賊 ⚓', blocks: '強奪', who: '対象プレイヤーのみ', color: 'text-blue-400' },
                  ].map(b => (
                    <div key={b.blocker + b.blocks} className="px-3 py-2 flex items-center gap-2">
                      <span className={`font-semibold min-w-[130px] ${b.color}`}>{b.blocker}</span>
                      <span className="text-gray-400 text-xs">が</span>
                      <span className="text-gray-200 font-semibold">{b.blocks}</span>
                      <span className="text-gray-500 text-xs ml-auto">{b.who}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Challenge rules */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">チャレンジのルール</h3>
                <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-gray-300">
                  <div className="flex gap-2"><span className="text-green-400 shrink-0">✓ 成功</span><span>チャレンジされた側がカードを見せた場合 → チャレンジした側が影響力を1つ失う。見せたカードはデッキに戻し新しいカードを引く</span></div>
                  <div className="flex gap-2"><span className="text-red-400 shrink-0">✗ 失敗</span><span>カードを持っていなかった場合 → チャレンジされた側が影響力を1つ失い、アクション失敗（有料アクションはコイン返還）</span></div>
                  <div className="flex gap-2 pt-1 border-t border-gray-700"><span className="text-yellow-400 shrink-0">⚠ 注意</span><span>暗殺にチャレンジして負けた場合、チャレンジ失敗の1つ＋暗殺の1つで計2影響力を失う可能性あり</span></div>
                </div>
              </section>

              {/* Influence */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">影響力・勝利条件</h3>
                <div className="bg-gray-800 rounded-lg p-3 text-gray-300 space-y-1">
                  <p>各プレイヤーは2枚の伏せカード（影響力）を持つ</p>
                  <p>影響力を失うたびにカードを1枚公開する</p>
                  <p>2枚とも公開されたプレイヤーは脱落</p>
                  <p className="text-amber-300 font-semibold">最後に残った1人が勝利</p>
                </div>
              </section>

              <button
                onClick={() => setShowSummary(false)}
                className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 rounded-xl text-base"
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
          <div className="mt-2 mx-4 bg-gray-800/95 border border-amber-500/60 text-amber-200 text-sm font-medium px-4 py-2 rounded-xl shadow-lg max-w-sm w-full text-center">
            {ticker}
          </div>
        </div>
      )}

      {/* Important event overlay — large centered card */}
      {eventOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6">
          <div className={`w-full max-w-sm rounded-2xl px-5 py-5 shadow-2xl text-center border-2 ${
            eventOverlay.kind === 'success'
              ? 'bg-emerald-950 border-emerald-400 text-emerald-50'
              : eventOverlay.kind === 'fail'
              ? 'bg-red-950 border-red-400 text-red-50'
              : eventOverlay.kind === 'elim'
              ? 'bg-gray-950 border-red-700 text-red-200'
              : 'bg-gray-900 border-amber-500 text-amber-100'
          }`}>
            <p className="text-lg font-bold leading-snug">{eventOverlay.text}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/40 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-xs px-1">← ホーム</a>
          <h1 className="text-amber-400 font-bold text-lg">COUP</h1>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="text-gray-300 hover:text-amber-400 text-xs border border-gray-600 hover:border-amber-500 px-2 py-1 rounded transition-colors"
        >
          📋 ルール
        </button>
        <span className="text-gray-300 text-sm">{coin(me?.coins ?? 0)} {me?.name}</span>
      </div>

      <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Other Players */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="text-gray-400 text-sm uppercase tracking-wide">プレイヤー</h2>
          {state.players.map(player => {
            // For CPU players use the delayed displayedPlayers so card changes
            // appear in sync with the ticker rather than jumping ahead.
            // For the human player always show the latest state.
            const isMe = player.id === playerId;
            const displayPlayer = isMe
              ? player
              : (displayedPlayers.find(p => p.id === player.id) ?? player);
            const isCurrentTurn = state.players[state.currentPlayerIndex]?.id === player.id;
            const isElim = !displayPlayer.isAlive;
            return (
              <div
                key={player.id}
                className={`rounded-lg p-3 border ${
                  isCurrentTurn ? 'border-amber-400 bg-amber-900/20' : 'border-gray-700 bg-gray-800/50'
                } ${isElim ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{player.name}</span>
                    {isMe && <span className="text-xs bg-blue-600 px-1 rounded">あなた</span>}
                    {player.isCPU && <span className="text-xs bg-gray-600 px-1 rounded">CPU</span>}
                    {isCurrentTurn && !isElim && <span className="text-xs bg-amber-600 px-1 rounded">ターン中</span>}
                    {isElim && <span className="text-xs bg-red-800 px-1 rounded">脱落</span>}
                  </div>
                  <span className="text-amber-300 font-mono">{coin(displayPlayer.coins)}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Face-down cards (hidden for others) */}
                  {displayPlayer.hand.map((card) => (
                    <div key={card.id}>
                      {isMe ? (
                        <CardDisplay character={card.character} small />
                      ) : (
                        <CardDisplay faceDown small />
                      )}
                    </div>
                  ))}
                  {/* Revealed cards */}
                  {displayPlayer.revealed.map(card => (
                    <CardDisplay key={card.id} character={card.character} small dead />
                  ))}
                  {/* Target button */}
                  {isMyTurn && !isMe && player.isAlive && selectedAction && ['coup', 'assassinate', 'steal'].includes(selectedAction) && (
                    <button
                      onClick={() => setSelectedTarget(player.id)}
                      className={`px-2 py-1 text-xs rounded border ${
                        selectedTarget === player.id
                          ? 'bg-red-600 border-red-400 text-white'
                          : 'bg-gray-700 border-gray-500 text-gray-300 hover:bg-red-800'
                      }`}
                    >
                      {selectedTarget === player.id ? '✓ 選択中' : 'ターゲット'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Action Panel */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-gray-400 text-sm uppercase tracking-wide mb-3">アクション</h2>

            {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

            {/* While ticker is replaying events, hide the next-state panel unless
                the human needs to act immediately (lose influence / reveal card). */}
            {tickerActive && !humanMustActNow ? (
              <p className="text-gray-500 text-sm text-center py-2">⟳ 確認中...</p>
            ) : (<></> /* render action panel normally below */)}
            {(!tickerActive || humanMustActNow) && (<>

            {/* My turn: select action */}
            {isMyTurn && state.phase === 'action_select' && (
              <div className="space-y-2">
                <p className="text-amber-300 text-sm font-semibold mb-2">あなたのターンです</p>
                {(['income', 'foreign_aid', 'coup', 'tax', 'assassinate', 'steal', 'exchange'] as ActionType[]).map(action => {
                  const canAfford = action === 'coup' ? (me?.coins ?? 0) >= 7
                    : action === 'assassinate' ? (me?.coins ?? 0) >= 3
                    : true;
                  const mustCoupNow = (me?.coins ?? 0) >= 10;
                  if (mustCoupNow && action !== 'coup') return null;
                  return (
                    <div key={action}>
                      <button
                        disabled={!canAfford}
                        onClick={() => { setSelectedAction(action); setSelectedTarget(null); }}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedAction === action
                            ? 'bg-amber-600 text-white'
                            : canAfford
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {ACTION_LABELS[action]}
                      </button>
                      {selectedAction === action && (
                        <p className="text-xs text-gray-400 px-2 py-1">{ACTION_DESC[action]}</p>
                      )}
                    </div>
                  );
                })}
                {selectedAction && (
                  <button
                    onClick={handleDeclareAction}
                    className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded"
                  >
                    実行する
                  </button>
                )}
              </div>
            )}

            {/* Not my turn: waiting */}
            {!isMyTurn && state.phase === 'action_select' && (
              <p className="text-gray-400 text-sm">{currentPlayer?.name} のターン...</p>
            )}

            {/* Reaction panel */}
            {isWaitingMyReaction && pa && (
              <div className="space-y-2">
                <div className="bg-yellow-900/40 border border-yellow-600 rounded-lg p-3">
                  <p className="text-yellow-200 text-sm font-bold">
                    ⚡ {state.players.find(p => p.id === pa.actorId)?.name} が宣言：
                  </p>
                  <p className="text-white text-base font-semibold mt-0.5">
                    {ACTION_LABELS[pa.type]}
                    {pa.targetId === playerId && <span className="text-red-300 ml-1">（あなたが対象！）</span>}
                    {pa.targetId && pa.targetId !== playerId && (
                      <span className="text-gray-300 ml-1 text-sm">
                        → {state.players.find(p => p.id === pa.targetId)?.name}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleReact('allow')}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg text-sm font-semibold"
                >
                  許可する
                </button>
                {pa.claimedCharacter && (
                  <button
                    onClick={() => handleReact('challenge')}
                    className="w-full bg-red-700 hover:bg-red-600 text-white py-3 rounded-lg text-sm font-semibold"
                  >
                    チャレンジ（{pa.claimedCharacter}を持っていない？）
                  </button>
                )}
                {canBlockAction && blockOptions.map(char => (
                  <button
                    key={char}
                    onClick={() => handleReact('block', char)}
                    className="w-full bg-blue-700 hover:bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold"
                  >
                    {char}でブロック
                  </button>
                ))}
              </div>
            )}

            {/* Waiting for others to react */}
            {state.phase === 'waiting_reactions' && !isWaitingMyReaction && (
              <div>
                <p className="text-gray-400 text-sm">他プレイヤーの反応を待っています...</p>
                {pa && (
                  <p className="text-gray-500 text-xs mt-1">
                    {ACTION_LABELS[pa.type]}
                    {pa.targetId ? ` → ${state.players.find(p => p.id === pa.targetId)?.name}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Block reaction */}
            {isWaitingMyBlockReaction && pa && (
              <div className="space-y-2">
                <p className="text-orange-300 text-sm font-semibold">
                  {state.players.find(p => p.id === pa.blockerId)?.name} が{' '}
                  {pa.blockerClaimedCharacter} でブロック！
                </p>
                <button
                  onClick={() => handleBlockReact('allow')}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-2 rounded text-sm"
                >
                  ブロックを受け入れる
                </button>
                <button
                  onClick={() => handleBlockReact('challenge')}
                  className="w-full bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm"
                >
                  チャレンジ ({pa.blockerClaimedCharacter}を持っていない?)
                </button>
              </div>
            )}

            {state.phase === 'waiting_block_reactions' && !isWaitingMyBlockReaction && (
              <p className="text-gray-400 text-sm">ブロックへの反応を待っています...</p>
            )}

            {/* Challenge resolution: show your card */}
            {isChallengedPlayer && me && (
              <div className="space-y-2">
                <p className="text-red-300 text-sm font-semibold">チャレンジされました！カードを選んで提示してください</p>
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
                <p className="text-red-400 text-sm font-semibold">影響力を1つ失います。カードを選んでください</p>
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
                <p className="text-amber-300 text-sm font-semibold">
                  {me.hand.length}枚選んで手札にする (残りは返却)
                </p>
                <p className="text-gray-400 text-xs">選択中: {selectedCards.length}/{me.hand.length}</p>
                <div className="flex gap-2 flex-wrap">
                  {[...me.hand, ...pa.exchangeDrawnCards].map(card => (
                    <div key={card.id} onClick={() => toggleCardSelect(card.id)} className="cursor-pointer">
                      <CardDisplay character={card.character} small selected={selectedCards.includes(card.id)} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExchange}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-sm"
                >
                  交換確定
                </button>
              </div>
            )}

            {/* Waiting states */}
            {(state.phase === 'resolving_challenge' || state.phase === 'resolving_block_challenge') && !isChallengedPlayer && (
              <p className="text-gray-400 text-sm">チャレンジを解決中...</p>
            )}
            {state.phase === 'lose_influence' && !isLoseInfluencePlayer && (
              <p className="text-gray-400 text-sm">
                {state.players.find(p => p.id === pa?.currentLoseInfluenceEntry?.playerId)?.name} が影響力を選んでいます...
              </p>
            )}
            {state.phase === 'exchange_select' && !isExchangePlayer && (
              <p className="text-gray-400 text-sm">密偵 が探索を選んでいます...</p>
            )}
            </>)}
          </div>

          {/* Game Log */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-gray-400 text-sm uppercase tracking-wide mb-2">ゲームログ</h2>
            <div ref={logRef} className="max-h-48 overflow-y-auto space-y-1">
              {state.log.map((l, i) => (
                <p key={i} className="text-xs text-gray-300">{l}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
