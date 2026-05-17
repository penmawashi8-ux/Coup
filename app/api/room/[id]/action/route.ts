import { NextResponse } from 'next/server';
import { getRoom, setRoom } from '@/lib/store';
import {
  declareAction,
  submitReaction,
  submitBlockReaction,
  resolveChallenge,
  chooseLoseInfluence,
  completeExchange,
  getCurrentPlayer,
  getPlayer,
} from '@/lib/game-engine';
import {
  cpuChooseAction,
  cpuChooseReaction,
  cpuChooseBlockReaction,
  cpuChooseLoseInfluence,
  cpuChooseExchangeCards,
} from '@/lib/cpu-ai';
import type { GameState, ActionType, ReactionType, Character } from '@/lib/types';

type ActionBody =
  | { type: 'declare_action'; playerId: string; action: ActionType; targetId?: string }
  | { type: 'react'; playerId: string; reaction: ReactionType; blockCharacter?: Character }
  | { type: 'react_block'; playerId: string; reaction: 'challenge' | 'allow' }
  | { type: 'resolve_challenge'; playerId: string; cardId: string }
  | { type: 'lose_influence'; playerId: string; cardId: string }
  | { type: 'exchange'; playerId: string; keptCardIds: string[] }
  | { type: 'start_game'; playerId: string };

function processCPUTurns(state: GameState): GameState {
  let s = state;
  let safetyCounter = 0;

  while (safetyCounter++ < 50) {
    if (s.phase === 'game_over') break;

    if (s.phase === 'action_select') {
      const current = getCurrentPlayer(s);
      if (!current.isCPU) break;
      const { action, targetId } = cpuChooseAction(s);
      s = declareAction(s, current.id, action, targetId);
      continue;
    }

    if (s.phase === 'waiting_reactions') {
      const pa = s.pendingAction!;
      const pendingCPU = Object.entries(pa.reactions)
        .filter(([, r]) => r === null)
        .map(([id]) => getPlayer(s, id))
        .filter(p => p?.isCPU);

      if (pendingCPU.length === 0) break;

      for (const cpu of pendingCPU) {
        if (!cpu) continue;
        const { reaction, blockCharacter } = cpuChooseReaction(s, cpu.id);
        s = submitReaction(s, cpu.id, reaction, blockCharacter);
      }
      continue;
    }

    if (s.phase === 'waiting_block_reactions') {
      const pa = s.pendingAction!;
      const pendingCPU = Object.entries(pa.blockReactions)
        .filter(([, r]) => r === null)
        .map(([id]) => getPlayer(s, id))
        .filter(p => p?.isCPU);

      if (pendingCPU.length === 0) break;

      for (const cpu of pendingCPU) {
        if (!cpu) continue;
        const reaction = cpuChooseBlockReaction(s, cpu.id);
        s = submitBlockReaction(s, cpu.id, reaction);
      }
      continue;
    }

    if (s.phase === 'resolving_challenge') {
      const pa = s.pendingAction!;
      const challengedId = pa.challengeTargetIsBlock ? pa.blockerId! : pa.actorId;
      const challenged = getPlayer(s, challengedId)!;
      if (!challenged.isCPU) break;
      const requiredChar = pa.challengeTargetIsBlock ? pa.blockerClaimedCharacter! : pa.claimedCharacter!;
      const matchCard = challenged.hand.find(c => c.character === requiredChar);
      const cardId = matchCard?.id ?? challenged.hand[0]?.id;
      if (!cardId) break;
      s = resolveChallenge(s, cardId);
      continue;
    }

    if (s.phase === 'resolving_block_challenge') {
      const pa = s.pendingAction!;
      const blockerId = pa.blockerId!;
      const blocker = getPlayer(s, blockerId)!;
      if (!blocker.isCPU) break;
      const requiredChar = pa.blockerClaimedCharacter!;
      const matchCard = blocker.hand.find(c => c.character === requiredChar);
      const cardId = matchCard?.id ?? blocker.hand[0]?.id;
      if (!cardId) break;
      s = resolveChallenge(s, cardId);
      continue;
    }

    if (s.phase === 'lose_influence') {
      const pa = s.pendingAction!;
      const playerId = pa.currentLoseInfluenceEntry?.playerId;
      if (!playerId) break;
      const player = getPlayer(s, playerId)!;
      if (!player.isCPU) break;
      const cardId = cpuChooseLoseInfluence(s, playerId);
      s = chooseLoseInfluence(s, playerId, cardId);
      continue;
    }

    if (s.phase === 'exchange_select') {
      const pa = s.pendingAction!;
      const actor = getPlayer(s, pa.actorId)!;
      if (!actor.isCPU) break;
      const allCards = [...actor.hand, ...(pa.exchangeDrawnCards ?? [])];
      const keptIds = cpuChooseExchangeCards(s, actor.id, allCards);
      s = completeExchange(s, actor.id, keptIds);
      continue;
    }

    break;
  }

  return s;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as ActionBody;

  let state = getRoom(id);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  try {
    switch (body.type) {
      case 'start_game': {
        if (state.phase !== 'lobby') break;
        if (state.hostId !== body.playerId) {
          return NextResponse.json({ error: 'Only host can start' }, { status: 403 });
        }
        const fresh = { ...state, phase: 'action_select' as const };
        state = processCPUTurns(fresh);
        break;
      }

      case 'declare_action': {
        const current = getCurrentPlayer(state);
        if (current.id !== body.playerId) {
          return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
        }
        state = declareAction(state, body.playerId, body.action, body.targetId);
        state = processCPUTurns(state);
        break;
      }

      case 'react': {
        state = submitReaction(state, body.playerId, body.reaction, body.blockCharacter);
        state = processCPUTurns(state);
        break;
      }

      case 'react_block': {
        state = submitBlockReaction(state, body.playerId, body.reaction);
        state = processCPUTurns(state);
        break;
      }

      case 'resolve_challenge': {
        state = resolveChallenge(state, body.cardId);
        state = processCPUTurns(state);
        break;
      }

      case 'lose_influence': {
        state = chooseLoseInfluence(state, body.playerId, body.cardId);
        state = processCPUTurns(state);
        break;
      }

      case 'exchange': {
        state = completeExchange(state, body.playerId, body.keptCardIds);
        state = processCPUTurns(state);
        break;
      }
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Game error' }, { status: 500 });
  }

  setRoom(id, state);
  return NextResponse.json(state);
}
