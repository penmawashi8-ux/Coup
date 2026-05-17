import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  Player,
  Card,
  Character,
  ActionType,
  PendingAction,
  ReactionType,
} from './types';

const CHARACTERS: Character[] = ['奉行', '忍者', '盗賊', '密偵', '姫'];

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const char of CHARACTERS) {
    for (let i = 0; i < 3; i++) {
      cards.push({ character: char, id: uuidv4() });
    }
  }
  return shuffle(cards);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(players: Array<{ id: string; name: string; isCPU: boolean }>, hostId: string): GameState {
  const deck = createDeck();
  const gamePlayers: Player[] = players.map((p, idx) => {
    const hand = [deck.shift()!, deck.shift()!];
    // 2-player: first player gets 1 coin
    const coins = players.length === 2 && idx === 0 ? 1 : 2;
    return {
      id: p.id,
      name: p.name,
      coins,
      hand,
      revealed: [],
      isAlive: true,
      isCPU: p.isCPU,
      connected: true,
    };
  });

  return {
    id: uuidv4(),
    phase: 'action_select',
    players: gamePlayers,
    deck,
    currentPlayerIndex: 0,
    pendingAction: null,
    log: ['Game started!'],
    winner: null,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    hostId,
  };
}

export function getAlivePlayers(state: GameState): Player[] {
  return state.players.filter(p => p.isAlive);
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getPlayer(state: GameState, id: string): Player | undefined {
  return state.players.find(p => p.id === id);
}

export function canChallenge(action: ActionType): boolean {
  return ['tax', 'assassinate', 'steal', 'exchange', 'foreign_aid'].includes(action)
    ? action !== 'foreign_aid'
    : false;
}

// foreign_aid cannot be challenged but can be blocked
export function isCharacterAction(action: ActionType): boolean {
  return ['tax', 'assassinate', 'steal', 'exchange'].includes(action);
}

export function getClaimedCharacter(action: ActionType): Character | undefined {
  const map: Partial<Record<ActionType, Character>> = {
    tax: '奉行',
    assassinate: '忍者',
    steal: '盗賊',
    exchange: '密偵',
  };
  return map[action];
}

export function canBlock(action: ActionType): boolean {
  return ['foreign_aid', 'assassinate', 'steal'].includes(action);
}

export function getBlockCharacters(action: ActionType): Character[] {
  const map: Partial<Record<ActionType, Character[]>> = {
    foreign_aid: ['奉行'],
    assassinate: ['姫'],
    steal: ['密偵', '盗賊'],
  };
  return map[action] ?? [];
}

export function canBeBlockedBy(action: ActionType, playerId: string, targetId: string | undefined, actorId: string): boolean {
  if (action === 'foreign_aid') return playerId !== actorId;
  if (action === 'assassinate' || action === 'steal') return playerId === targetId;
  return false;
}

function addLog(state: GameState, msg: string): void {
  state.log = [...state.log.slice(-49), msg];
  state.lastUpdated = Date.now();
}

export function declareAction(
  state: GameState,
  actorId: string,
  action: ActionType,
  targetId?: string
): GameState {
  const s = deepClone(state);
  const actor = getPlayer(s, actorId)!;
  const target = targetId ? getPlayer(s, targetId) : undefined;

  const coinCost = action === 'coup' ? 7 : action === 'assassinate' ? 3 : 0;
  const claimedChar = getClaimedCharacter(action);

  // Deduct coins immediately for paid actions
  actor.coins -= coinCost;

  const actionNames: Record<ActionType, string> = {
    income: 'Income',
    foreign_aid: 'Foreign Aid',
    coup: 'Coup',
    tax: '徴収 (奉行)',
    assassinate: '暗殺 (忍者)',
    steal: '強奪 (盗賊)',
    exchange: '探索 (密偵)',
  };
  addLog(s, `${actor.name} declares ${actionNames[action]}${target ? ` against ${target.name}` : ''}.`);

  // Income and Coup resolve immediately
  if (action === 'income' || action === 'coup') {
    s.pendingAction = null;
    if (action === 'income') {
      actor.coins += 1;
      addLog(s, `${actor.name} takes 1 coin. (${actor.coins} coins)`);
    } else {
      addLog(s, `${actor.name} launches Coup against ${target!.name}!`);
      return openLoseInfluence(s, target!.id, 'Coup', actorId, action, coinCost);
    }
    return advanceTurn(s);
  }

  // Build pending action with reaction tracking
  const otherAlive = getAlivePlayers(s).filter(p => p.id !== actorId);
  const reactions: Record<string, ReactionType | null> = {};
  for (const p of otherAlive) reactions[p.id] = null;

  s.pendingAction = {
    actorId,
    type: action,
    targetId,
    coinCost,
    claimedCharacter: claimedChar,
    reactions,
    blockerId: undefined,
    blockerClaimedCharacter: undefined,
    blockReactions: {},
    challengerId: undefined,
    challengeTargetIsBlock: false,
    loseInfluenceQueue: [],
    continuationAfterChallenge: undefined,
  };
  s.phase = 'waiting_reactions';

  return s;
}

export function submitReaction(
  state: GameState,
  playerId: string,
  reaction: ReactionType,
  blockCharacter?: Character
): GameState {
  if (state.phase !== 'waiting_reactions') return state;
  const s = deepClone(state);
  const pa = s.pendingAction!;

  if (!(playerId in pa.reactions)) return s;
  pa.reactions[playerId] = reaction;

  if (reaction === 'block') {
    // Block declaration: record who is blocking and with what
    pa.blockerId = playerId;
    pa.blockerClaimedCharacter = blockCharacter;
    const blocker = getPlayer(s, playerId)!;
    addLog(s, `${blocker.name} blocks${blockCharacter ? ` (claiming ${blockCharacter})` : ''}.`);
    // Override remaining reactions to 'allow' - first block wins
    for (const id of Object.keys(pa.reactions)) {
      if (pa.reactions[id] === null) pa.reactions[id] = 'allow';
    }
  } else if (reaction === 'challenge') {
    const challenger = getPlayer(s, playerId)!;
    addLog(s, `${challenger.name} challenges!`);
    // Mark remaining as allow
    for (const id of Object.keys(pa.reactions)) {
      if (pa.reactions[id] === null) pa.reactions[id] = 'allow';
    }
  }

  return checkReactionsComplete(s);
}

function checkReactionsComplete(s: GameState): GameState {
  const pa = s.pendingAction!;
  const allResponded = Object.values(pa.reactions).every(r => r !== null);
  if (!allResponded) return s;

  const challengerEntry = Object.entries(pa.reactions).find(([, r]) => r === 'challenge');
  const blocker = pa.blockerId;

  if (challengerEntry) {
    // Someone challenged the action
    pa.challengerId = challengerEntry[0];
    pa.challengeTargetIsBlock = false;
    s.phase = 'resolving_challenge';
    return s;
  }

  if (blocker) {
    // Action is blocked, open block challenge window
    return openBlockReactions(s);
  }

  // No challenge, no block → resolve action
  return resolveAction(s);
}

function openBlockReactions(s: GameState): GameState {
  const pa = s.pendingAction!;
  const alive = getAlivePlayers(s);
  const blockReactions: Record<string, 'challenge' | 'allow' | null> = {};
  for (const p of alive) {
    if (p.id !== pa.blockerId) blockReactions[p.id] = null;
  }
  pa.blockReactions = blockReactions;
  s.phase = 'waiting_block_reactions';
  return s;
}

export function submitBlockReaction(
  state: GameState,
  playerId: string,
  reaction: 'challenge' | 'allow'
): GameState {
  if (state.phase !== 'waiting_block_reactions') return state;
  const s = deepClone(state);
  const pa = s.pendingAction!;

  if (!(playerId in pa.blockReactions)) return s;
  pa.blockReactions[playerId] = reaction;

  if (reaction === 'challenge') {
    const challenger = getPlayer(s, playerId)!;
    addLog(s, `${challenger.name} challenges the block!`);
    for (const id of Object.keys(pa.blockReactions)) {
      if (pa.blockReactions[id] === null) pa.blockReactions[id] = 'allow';
    }
  }

  const allResponded = Object.values(pa.blockReactions).every(r => r !== null);
  if (!allResponded) return s;

  const challengerEntry = Object.entries(pa.blockReactions).find(([, r]) => r === 'challenge');
  if (challengerEntry) {
    pa.challengerId = challengerEntry[0];
    pa.challengeTargetIsBlock = true;
    s.phase = 'resolving_block_challenge';
    return s;
  }

  // Block not challenged → action blocked
  return resolveBlocked(s);
}

export function resolveChallenge(
  state: GameState,
  revealCardId: string
): GameState {
  const s = deepClone(state);
  const pa = s.pendingAction!;
  const isBlockChallenge = pa.challengeTargetIsBlock;

  const challengedPlayerId = isBlockChallenge ? pa.blockerId! : pa.actorId;
  const requiredChar = isBlockChallenge ? pa.blockerClaimedCharacter! : pa.claimedCharacter!;
  const challengerId = pa.challengerId!;

  const challengedPlayer = getPlayer(s, challengedPlayerId)!;
  const challenger = getPlayer(s, challengerId)!;

  const card = challengedPlayer.hand.find(c => c.id === revealCardId);
  const hasCard = card && card.character === requiredChar;

  if (hasCard) {
    // Challenged player wins: challenger loses influence
    addLog(s, `${challengedPlayer.name} reveals ${card!.character}. Challenge fails! ${challenger.name} loses an influence.`);
    // Swap challenged player's card back to deck
    challengedPlayer.hand = challengedPlayer.hand.filter(c => c.id !== revealCardId);
    s.deck = shuffle([...s.deck, card!]);
    const newCard = s.deck.shift()!;
    challengedPlayer.hand.push(newCard);

    // Challenger loses influence
    if (challenger.hand.length === 1) {
      // Auto-reveal only card
      const lostCard = challenger.hand[0];
      challenger.revealed.push(lostCard);
      challenger.hand = [];
      challenger.isAlive = false;
      addLog(s, `${challenger.name} reveals ${lostCard.character} and is eliminated!`);
      return postChallengeResolution(s, true, isBlockChallenge);
    } else {
      pa.loseInfluenceQueue = [{ playerId: challengerId, reason: 'Lost challenge' }];
      pa.continuationAfterChallenge = isBlockChallenge ? 'resolve_block_succeeded' : 'resolve_action';
      return openNextLoseInfluence(s);
    }
  } else {
    // Challenged player loses: they lose influence
    addLog(s, `${challengedPlayer.name} cannot show ${requiredChar}. Challenge succeeds! ${challengedPlayer.name} loses an influence.`);

    if (challengedPlayer.hand.length === 1) {
      const lostCard = challengedPlayer.hand[0];
      challengedPlayer.revealed.push(lostCard);
      challengedPlayer.hand = [];
      challengedPlayer.isAlive = false;
      addLog(s, `${challengedPlayer.name} reveals ${lostCard.character} and is eliminated!`);
      return postChallengeResolution(s, false, isBlockChallenge);
    } else {
      pa.loseInfluenceQueue = [{ playerId: challengedPlayerId, reason: 'Lost challenge' }];
      pa.continuationAfterChallenge = isBlockChallenge ? 'challenge_won_block_fails' : 'action_fails';
      return openNextLoseInfluence(s);
    }
  }
}

function postChallengeResolution(s: GameState, challengerLost: boolean, isBlockChallenge: boolean): GameState {
  const pa = s.pendingAction!;
  if (isBlockChallenge) {
    if (challengerLost) {
      // Block succeeds
      return resolveBlocked(s);
    } else {
      // Block fails, original action resolves
      return resolveAction(s);
    }
  } else {
    // Challenged the action
    if (challengerLost) {
      // Action resolves — the block window was already open during initial reactions
      return resolveAction(s);
    } else {
      // Action fails
      return actionFails(s);
    }
  }
}

function openNextLoseInfluence(s: GameState): GameState {
  const pa = s.pendingAction!;
  if (pa.loseInfluenceQueue.length === 0) {
    // Continue based on continuation
    return handleContinuation(s);
  }
  pa.currentLoseInfluenceEntry = pa.loseInfluenceQueue.shift();
  s.phase = 'lose_influence';
  return s;
}

export function chooseLoseInfluence(state: GameState, playerId: string, cardId: string): GameState {
  if (state.phase !== 'lose_influence') return state;
  const s = deepClone(state);
  const pa = s.pendingAction!;

  if (pa.currentLoseInfluenceEntry?.playerId !== playerId) return s;

  const player = getPlayer(s, playerId)!;
  const card = player.hand.find(c => c.id === cardId);
  if (!card) return s;

  player.hand = player.hand.filter(c => c.id !== cardId);
  player.revealed.push(card);
  if (player.hand.length === 0) {
    player.isAlive = false;
    addLog(s, `${player.name} reveals ${card.character} and is eliminated!`);
  } else {
    addLog(s, `${player.name} reveals ${card.character} and loses an influence.`);
  }

  pa.currentLoseInfluenceEntry = undefined;
  return handleContinuation(s);
}

function handleContinuation(s: GameState): GameState {
  const pa = s.pendingAction!;
  const cont = pa.continuationAfterChallenge as string | undefined;

  if (cont === 'action_fails') return actionFails(s);
  if (cont === 'resolve_action') {
    return resolveAction(s);
  }
  if (cont === 'challenge_won_block_fails') return resolveAction(s);
  if (cont === 'resolve_block_succeeded') return resolveBlocked(s);

  // No continuation set: this was from a direct loss (auto-reveal)
  const isBlockChallenge = pa.challengeTargetIsBlock;
  if (isBlockChallenge) {
    return resolveBlocked(s);
  }
  // Check if there's more in queue
  if (pa.loseInfluenceQueue.length > 0) {
    return openNextLoseInfluence(s);
  }
  return advanceTurn(s);
}

function resolveBlocked(s: GameState): GameState {
  const pa = s.pendingAction!;
  const actor = getPlayer(s, pa.actorId)!;
  addLog(s, `Action blocked. ${actor.name}'s coins paid remain spent.`);
  s.pendingAction = null;
  return advanceTurn(s);
}

function actionFails(s: GameState): GameState {
  const pa = s.pendingAction!;
  const actor = getPlayer(s, pa.actorId)!;
  // Return coins for paid actions that were challenged successfully
  if (pa.coinCost > 0) {
    actor.coins += pa.coinCost;
    addLog(s, `Action failed. ${actor.name} gets back ${pa.coinCost} coin(s).`);
  } else {
    addLog(s, `Action failed.`);
  }
  s.pendingAction = null;
  return advanceTurn(s);
}

function resolveAction(s: GameState): GameState {
  const pa = s.pendingAction!;
  const actor = getPlayer(s, pa.actorId)!;
  const target = pa.targetId ? getPlayer(s, pa.targetId) : undefined;

  switch (pa.type) {
    case 'foreign_aid':
      actor.coins += 2;
      addLog(s, `${actor.name} takes 2 coins via Foreign Aid. (${actor.coins} coins)`);
      s.pendingAction = null;
      return advanceTurn(s);

    case 'tax':
      actor.coins += 3;
      addLog(s, `${actor.name} takes 3 coins via Tax. (${actor.coins} coins)`);
      s.pendingAction = null;
      return advanceTurn(s);

    case 'steal': {
      const stolen = Math.min(2, target!.coins);
      target!.coins -= stolen;
      actor.coins += stolen;
      addLog(s, `${actor.name} steals ${stolen} coin(s) from ${target!.name}.`);
      s.pendingAction = null;
      return advanceTurn(s);
    }

    case 'assassinate':
      addLog(s, `${actor.name} assassinates ${target!.name}!`);
      return openLoseInfluence(s, target!.id, 'Assassination', pa.actorId, pa.type, pa.coinCost);

    case 'exchange': {
      const drawn = [s.deck.shift()!, s.deck.shift()!];
      pa.exchangeDrawnCards = drawn;
      addLog(s, `${actor.name} draws 2 cards from the Court for exchange.`);
      s.phase = 'exchange_select';
      return s;
    }

    default:
      s.pendingAction = null;
      return advanceTurn(s);
  }
}

function openLoseInfluence(
  s: GameState,
  targetId: string,
  reason: string,
  _actorId: string,
  _actionType: ActionType,
  _coinCost: number
): GameState {
  const target = getPlayer(s, targetId)!;
  if (!s.pendingAction) {
    s.pendingAction = {
      actorId: _actorId,
      type: _actionType,
      coinCost: _coinCost,
      reactions: {},
      blockReactions: {},
      challengeTargetIsBlock: false,
      loseInfluenceQueue: [],
    };
  }

  if (target.hand.length === 1) {
    const lostCard = target.hand[0];
    target.hand = [];
    target.revealed.push(lostCard);
    target.isAlive = false;
    addLog(s, `${target.name} reveals ${lostCard.character} and is eliminated!`);
    s.pendingAction = null;
    return advanceTurn(s);
  }

  s.pendingAction.currentLoseInfluenceEntry = { playerId: targetId, reason };
  s.pendingAction.loseInfluenceQueue = [];
  s.phase = 'lose_influence';
  return s;
}

export function completeExchange(state: GameState, actorId: string, keptCardIds: string[]): GameState {
  if (state.phase !== 'exchange_select') return state;
  const s = deepClone(state);
  const pa = s.pendingAction!;
  const actor = getPlayer(s, actorId)!;

  const allCards = [...actor.hand, ...(pa.exchangeDrawnCards ?? [])];
  const kept = allCards.filter(c => keptCardIds.includes(c.id));
  const returned = allCards.filter(c => !keptCardIds.includes(c.id));

  if (kept.length !== actor.hand.length) return s; // Must keep same number

  actor.hand = kept;
  s.deck = shuffle([...s.deck, ...returned]);
  addLog(s, `${actor.name} completes the exchange.`);
  s.pendingAction = null;
  return advanceTurn(s);
}

function advanceTurn(s: GameState): GameState {
  const alive = getAlivePlayers(s);
  if (alive.length <= 1) {
    s.winner = alive[0]?.id ?? null;
    s.phase = 'game_over';
    if (s.winner) {
      const w = getPlayer(s, s.winner)!;
      addLog(s, `${w.name} wins the game!`);
    }
    return s;
  }

  // Advance to next alive player
  let idx = s.currentPlayerIndex;
  do {
    idx = (idx + 1) % s.players.length;
  } while (!s.players[idx].isAlive);
  s.currentPlayerIndex = idx;

  // Check 10+ coin rule
  const current = s.players[idx];
  if (current.coins >= 10) {
    addLog(s, `${current.name} has ${current.coins} coins and MUST launch a Coup!`);
  }

  s.phase = 'action_select';
  return s;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function mustCoup(player: Player): boolean {
  return player.coins >= 10;
}

export function canAfford(player: Player, action: ActionType): boolean {
  if (action === 'coup') return player.coins >= 7;
  if (action === 'assassinate') return player.coins >= 3;
  return true;
}

export function getAvailableActions(state: GameState, playerId: string): ActionType[] {
  const player = getPlayer(state, playerId)!;
  if (mustCoup(player)) return ['coup'];
  const actions: ActionType[] = ['income', 'foreign_aid', 'tax', 'exchange', 'steal'];
  if (player.coins >= 3) actions.push('assassinate');
  if (player.coins >= 7) actions.push('coup');
  return actions;
}
