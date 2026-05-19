import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
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
  createGame,
  autoHandlePlayer,
} from '@/lib/game-engine';
import {
  cpuChooseAction,
  cpuChooseReaction,
  cpuChooseBlockReaction,
  cpuChooseLoseInfluence,
  cpuChooseExchangeCards,
} from '@/lib/cpu-ai';
import type { GameState, ActionType, ReactionType, Character } from '@/lib/types';

type ActionBody = (
  | { type: 'declare_action'; playerId: string; action: ActionType; targetId?: string }
  | { type: 'react'; playerId: string; reaction: ReactionType; blockCharacter?: Character }
  | { type: 'react_block'; playerId: string; reaction: 'challenge' | 'allow' }
  | { type: 'resolve_challenge'; playerId: string; cardId: string }
  | { type: 'lose_influence'; playerId: string; cardId: string }
  | { type: 'exchange'; playerId: string; keptCardIds: string[] }
  | { type: 'start_game'; playerId: string; cpuCount?: number }
  | { type: 'skip_player'; playerId: string; targetPlayerId: string }
) & { clientState?: GameState };

function humanHasPendingReaction(reactions: Record<string, unknown>, players: GameState['players']): boolean {
  return Object.entries(reactions)
    .filter(([, r]) => r === null)
    .some(([id]) => {
      const p = players.find(pl => pl.id === id);
      return p && !p.isCPU;
    });
}

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
      // Always wait for the human player to react first
      if (humanHasPendingReaction(pa.reactions, s.players)) break;
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
      // Always wait for the human player to react first
      if (humanHasPendingReaction(pa.blockReactions, s.players)) break;
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
      const blockerId = pa.blockerId;
      if (!blockerId) break;
      const blocker = getPlayer(s, blockerId);
      if (!blocker || !blocker.isCPU) break;
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

  // For CPU-only games (single human), always trust clientState as it's guaranteed
  // to be the latest state returned by the previous action response.
  // getRoom may return stale state from another serverless instance, which causes
  // pa.challengerId to be from an old state and the wrong player to lose a card.
  const isCPUGame = !!(body.clientState && body.clientState.players.filter(p => !p.isCPU).length === 1);
  let state = (isCPUGame && body.clientState) ? body.clientState : await getRoom(id);
  if (!state && body.clientState) state = body.clientState;
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  try {
    switch (body.type) {
      case 'start_game': {
        if (state.phase !== 'lobby') break;
        if (state.hostId !== body.playerId) {
          return NextResponse.json({ error: 'Only host can start' }, { status: 403 });
        }
        const playerDefs = state.players.map(p => ({ id: p.id, name: p.name, isCPU: p.isCPU }));
        let cpuIdx = playerDefs.filter(p => p.isCPU).length + 1;
        // Add requested CPUs from host, then ensure minimum 2 players
        const requestedCPUs = body.cpuCount ?? 0;
        for (let i = 0; i < requestedCPUs; i++) {
          playerDefs.push({ id: uuidv4(), name: `CPU ${cpuIdx++}`, isCPU: true });
        }
        while (playerDefs.length < 2) {
          playerDefs.push({ id: uuidv4(), name: `CPU ${cpuIdx++}`, isCPU: true });
        }
        const started = createGame(playerDefs, state.hostId);
        started.id = state.id;
        state = processCPUTurns(started);
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

      case 'skip_player': {
        state = autoHandlePlayer(state, body.targetPlayerId);
        state = processCPUTurns(state);
        break;
      }
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Game error' }, { status: 500 });
  }

  await setRoom(id, state);
  return NextResponse.json(state);
}
