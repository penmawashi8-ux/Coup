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
  tax: '徴税・Duke (3コイン)',
  assassinate: '暗殺・Assassin (3コイン)',
  steal: '窃盗・Captain (2コイン盗む)',
  exchange: 'カード交換・Ambassador',
};

const ACTION_DESC: Record<ActionType, string> = {
  income: '財務省から1コイン取る。妨害不可。',
  foreign_aid: '財務省から2コイン取る。Dukeがいるとブロック可。',
  coup: '7コイン支払い、対象プレイヤーの影響力1つを除去。',
  tax: 'Duke役を主張し、財務省から3コイン取る。',
  assassinate: '3コイン支払い、対象の影響力1つを除去。Contessaでブロック可。',
  steal: 'Captain役を主張し、対象から2コイン盗む。Ambassador/Captainでブロック可。',
  exchange: 'Ambassador役を主張し、Court山から2枚引いてカードを交換する。',
};

const CHAR_LABELS: Record<Character, string> = {
  Duke: 'Duke (公爵)',
  Assassin: 'Assassin (暗殺者)',
  Captain: 'Captain (船長)',
  Ambassador: 'Ambassador (大使)',
  Contessa: 'Contessa (伯爵夫人)',
};

function coin(n: number) {
  return `💰${n}`;
}

export default function GameBoard({ roomId, playerId, initialState, isOnline }: Props) {
  const [state, setState] = useState<GameState>(initialState);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const res = await fetch(`/api/room/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const isChallengedPlayer = state.phase === 'resolving_challenge' && pa &&
    (!pa.challengeTargetIsBlock ? pa.actorId === playerId : pa.blockerId === playerId);
  const isLoseInfluencePlayer = state.phase === 'lose_influence' && pa?.currentLoseInfluenceEntry?.playerId === playerId;
  const isExchangePlayer = state.phase === 'exchange_select' && pa?.actorId === playerId;

  // Block options for my reaction
  const getBlockOptions = () => {
    if (!pa) return [];
    const { type, targetId, actorId } = pa;
    if (!['foreign_aid', 'assassinate', 'steal'].includes(type)) return [];
    if (type === 'foreign_aid' && playerId !== actorId) return ['Duke'] as Character[];
    if ((type === 'assassinate' || type === 'steal') && playerId === targetId) {
      if (type === 'assassinate') return ['Contessa'] as Character[];
      return ['Ambassador', 'Captain'] as Character[];
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
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <h1 className="text-4xl font-black text-amber-400 mb-6">COUP</h1>
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
              <button
                onClick={() => sendAction({ type: 'start_game', playerId })}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl"
              >
                ゲーム開始（今いるメンバーで）
              </button>
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
      {/* Header */}
      <div className="bg-black/40 p-3 flex items-center justify-between">
        <h1 className="text-amber-400 font-bold text-lg">COUP</h1>
        <span className="text-gray-400 text-sm">Room: {roomId}</span>
        <span className="text-gray-300 text-sm">{coin(me?.coins ?? 0)} {me?.name}</span>
      </div>

      <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Other Players */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="text-gray-400 text-sm uppercase tracking-wide">プレイヤー</h2>
          {state.players.map(player => {
            const isCurrentTurn = state.players[state.currentPlayerIndex]?.id === player.id;
            const isElim = !player.isAlive;
            const isMe = player.id === playerId;
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
                  <span className="text-amber-300 font-mono">{coin(player.coins)}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Face-down cards (hidden for others) */}
                  {player.hand.map((card, i) => (
                    <div key={card.id}>
                      {isMe ? (
                        <CardDisplay character={card.character} small />
                      ) : (
                        <CardDisplay faceDown small />
                      )}
                    </div>
                  ))}
                  {/* Revealed cards */}
                  {player.revealed.map(card => (
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
                <p className="text-yellow-300 text-sm font-semibold">
                  {state.players.find(p => p.id === pa.actorId)?.name} が{' '}
                  {ACTION_LABELS[pa.type]} を宣言
                  {pa.targetId === playerId && <span className="text-red-400"> (あなたが対象!)</span>}
                </p>
                <button
                  onClick={() => handleReact('allow')}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-2 rounded text-sm"
                >
                  許可する
                </button>
                {pa.claimedCharacter && (
                  <button
                    onClick={() => handleReact('challenge')}
                    className="w-full bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm"
                  >
                    チャレンジ ({pa.claimedCharacter}を持っていない?)
                  </button>
                )}
                {canBlockAction && blockOptions.map(char => (
                  <button
                    key={char}
                    onClick={() => handleReact('block', char)}
                    className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 rounded text-sm"
                  >
                    {CHAR_LABELS[char]}でブロック
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
              <p className="text-gray-400 text-sm">Ambassador が交換を選んでいます...</p>
            )}
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
