// In-memory store for game rooms
// Works for single-process Node.js (dev + single-instance prod)
// For multi-instance Vercel, swap with @vercel/kv

import type { GameState } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __gameRooms: Map<string, GameState> | undefined;
}

function getRooms(): Map<string, GameState> {
  if (!global.__gameRooms) {
    global.__gameRooms = new Map();
  }
  return global.__gameRooms;
}

export function getRoom(id: string): GameState | null {
  return getRooms().get(id) ?? null;
}

export function setRoom(id: string, state: GameState): void {
  getRooms().set(id, state);
  // Clean up old rooms (>2 hours)
  const now = Date.now();
  for (const [k, v] of getRooms()) {
    if (now - v.createdAt > 2 * 60 * 60 * 1000) {
      getRooms().delete(k);
    }
  }
}

export function deleteRoom(id: string): void {
  getRooms().delete(id);
}

export function listRooms(): GameState[] {
  return Array.from(getRooms().values());
}
