export type Character = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

export type ActionType =
  | 'income'
  | 'foreign_aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';

export type GamePhase =
  | 'lobby'
  | 'action_select'
  | 'waiting_reactions'
  | 'waiting_block_reactions'
  | 'resolving_challenge'
  | 'resolving_block_challenge'
  | 'lose_influence'
  | 'exchange_select'
  | 'game_over';

export type ReactionType = 'allow' | 'challenge' | 'block';

export interface Card {
  character: Character;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  hand: Card[];        // face-down (hidden)
  revealed: Card[];    // face-up (lost influence)
  isAlive: boolean;
  isCPU: boolean;
  connected: boolean;
}

export interface PendingAction {
  actorId: string;
  type: ActionType;
  targetId?: string;
  coinCost: number;
  claimedCharacter?: Character;
  // Reactions from other players to the action
  reactions: Record<string, ReactionType | null>;
  // Block info
  blockerId?: string;
  blockerClaimedCharacter?: Character;
  blockReactions: Record<string, 'challenge' | 'allow' | null>;
  // Challenge tracking
  challengerId?: string;
  challengeTargetIsBlock: boolean;
  // After challenge resolved, if action still goes on
  continuationAfterChallenge?: 'resolve_action' | 'open_block' | 'action_fails' | 'challenge_won_block_fails' | 'resolve_block_succeeded';
  // Lose influence tracking
  loseInfluenceQueue: Array<{ playerId: string; reason: string }>;
  currentLoseInfluenceEntry?: { playerId: string; reason: string };
  // Exchange cards drawn from court
  exchangeDrawnCards?: Card[];
}

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  currentPlayerIndex: number;
  pendingAction: PendingAction | null;
  log: string[];
  winner: string | null;
  createdAt: number;
  lastUpdated: number;
  hostId: string;
}

export interface GameRoom {
  id: string;
  gameState: GameState;
}

export type CPUDifficulty = 'easy' | 'normal' | 'hard';
