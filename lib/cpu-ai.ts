import type { GameState, Player, ActionType, ReactionType, Character, Card } from './types';
import {
  getAlivePlayers,
  getCurrentPlayer,
  getPlayer,
  getAvailableActions,
  canBlock,
  getBlockCharacters,
  canBeBlockedBy,
  isCharacterAction,
  mustCoup,
} from './game-engine';

function rand(n: number): number {
  return Math.floor(Math.random() * n);
}

function hasCharacter(player: Player, char: Character): boolean {
  return player.hand.some(c => c.character === char);
}

function influenceCount(player: Player): number {
  return player.hand.length;
}

// Pick the most threatening target (most coins + influences)
function pickTarget(state: GameState, actorId: string): Player {
  const others = getAlivePlayers(state).filter(p => p.id !== actorId && !p.isCPU);
  if (others.length === 0) {
    return getAlivePlayers(state).find(p => p.id !== actorId)!;
  }
  return others.sort((a, b) => (b.coins + b.hand.length * 5) - (a.coins + a.hand.length * 5))[0];
}

export function cpuChooseAction(state: GameState): {
  action: ActionType;
  targetId?: string;
} {
  const actor = getCurrentPlayer(state);
  const available = getAvailableActions(state, actor.id);

  if (mustCoup(actor)) {
    const target = pickTarget(state, actor.id);
    return { action: 'coup', targetId: target.id };
  }

  // Always coup if possible and there's a good target
  if (available.includes('coup') && actor.coins >= 7) {
    const target = pickTarget(state, actor.id);
    if (influenceCount(target) === 1 || actor.coins >= 9) {
      return { action: 'coup', targetId: target.id };
    }
  }

  // Use actual character abilities
  if (hasCharacter(actor, '刺客') && actor.coins >= 3 && available.includes('assassinate')) {
    const target = pickTarget(state, actor.id);
    return { action: 'assassinate', targetId: target.id };
  }

  if (hasCharacter(actor, '将軍') && available.includes('tax')) {
    return { action: 'tax' };
  }

  if (hasCharacter(actor, '海賊') && available.includes('steal')) {
    const targets = getAlivePlayers(state).filter(p => p.id !== actor.id && p.coins >= 1);
    if (targets.length > 0) {
      const target = targets.sort((a, b) => b.coins - a.coins)[0];
      return { action: 'steal', targetId: target.id };
    }
  }

  if (hasCharacter(actor, '忍者') && available.includes('exchange')) {
    // Exchange if hand has weak cards
    return { action: 'exchange' };
  }

  // Bluff actions based on coins
  if (actor.coins >= 5 && available.includes('assassinate')) {
    const target = pickTarget(state, actor.id);
    return { action: 'assassinate', targetId: target.id };
  }

  // Foreign aid or tax
  if (rand(2) === 0 && available.includes('tax')) return { action: 'tax' };
  if (available.includes('foreign_aid')) return { action: 'foreign_aid' };
  return { action: 'income' };
}

export function cpuChooseReaction(
  state: GameState,
  cpuId: string
): { reaction: ReactionType; blockCharacter?: Character } {
  const cpu = getPlayer(state, cpuId)!;
  const pa = state.pendingAction!;
  const actor = getPlayer(state, pa.actorId)!;

  // Can this CPU block?
  if (canBeBlockedBy(pa.type, cpuId, pa.targetId, pa.actorId)) {
    const blockChars = getBlockCharacters(pa.type);
    const ownedBlockChar = blockChars.find(c => hasCharacter(cpu, c));

    if (ownedBlockChar) {
      // Always block if we have the right card
      return { reaction: 'block', blockCharacter: ownedBlockChar };
    }

    // Bluff block sometimes (especially as target when being assassinated)
    if (pa.type === 'assassinate' && cpuId === pa.targetId) {
      if (rand(3) === 0) {
        return { reaction: 'block', blockCharacter: '女王' };
      }
    }
  }

  // Challenge only when we have strong evidence of a bluff
  // (i.e. we hold / have seen enough copies to know actor likely doesn't have it)
  if (isCharacterAction(pa.type) && pa.claimedCharacter) {
    const visibleCount = state.players.flatMap(p => p.revealed)
      .filter(c => c.character === pa.claimedCharacter).length;
    const inOurHand = cpu.hand.filter(c => c.character === pa.claimedCharacter).length;
    const accounted = visibleCount + inOurHand;

    if (accounted >= 3) {
      // All 3 copies accounted for — certain bluff
      return { reaction: 'challenge' };
    }
    if (accounted >= 2 && rand(4) === 0) {
      // 2 of 3 copies accounted for — likely bluff, challenge 25%
      return { reaction: 'challenge' };
    }
    // Otherwise assume actor might legitimately have it
  }

  return { reaction: 'allow' };
}

export function cpuChooseBlockReaction(
  state: GameState,
  cpuId: string
): 'challenge' | 'allow' {
  const cpu = getPlayer(state, cpuId)!;
  const pa = state.pendingAction!;
  const blockerChar = pa.blockerClaimedCharacter;

  if (!blockerChar) return 'allow';

  if (cpuId === pa.actorId) {
    const visibleCount = state.players.flatMap(p => p.revealed)
      .filter(c => c.character === blockerChar).length;
    const inOurHand = cpu.hand.filter(c => c.character === blockerChar).length;
    const accounted = visibleCount + inOurHand;

    if (accounted >= 3) return 'challenge';
    if (accounted >= 2 && rand(4) === 0) return 'challenge';
  }
  return 'allow';
}

export function cpuChooseLoseInfluence(state: GameState, cpuId: string): string {
  const cpu = getPlayer(state, cpuId)!;
  // Lose the card that is least useful — sort most dispensable first (highest index)
  const priority: Character[] = ['女王', '将軍', '忍者', '海賊', '刺客'];
  const sorted = [...cpu.hand].sort((a, b) => {
    return priority.indexOf(b.character) - priority.indexOf(a.character);
  });
  return sorted[0]?.id ?? cpu.hand[0].id;
}

export function cpuChooseExchangeCards(state: GameState, cpuId: string, allCards: Card[]): string[] {
  const cpu = getPlayer(state, cpuId)!;
  const handSize = cpu.hand.length;
  const priority: Character[] = ['刺客', '将軍', '海賊', '忍者', '女王'];
  const sorted = [...allCards].sort((a, b) => {
    return priority.indexOf(a.character) - priority.indexOf(b.character);
  });
  return sorted.slice(0, handSize).map(c => c.id);
}
