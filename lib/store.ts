// State store: uses @vercel/kv when KV_REST_API_URL is set (Vercel production),
// falls back to in-memory Map for local development.

import type { GameState } from './types';

// In-memory fallback for local dev / single-process environments
declare global {
  // eslint-disable-next-line no-var
  var __gameRooms: Map<string, GameState> | undefined;
}

function getMemoryRooms(): Map<string, GameState> {
  if (!global.__gameRooms) global.__gameRooms = new Map();
  return global.__gameRooms;
}

function useKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(id: string): Promise<GameState | null> {
  const { kv } = await import('@vercel/kv');
  return kv.get<GameState>(`room:${id}`);
}

async function kvSet(id: string, state: GameState): Promise<void> {
  const { kv } = await import('@vercel/kv');
  // Expire after 3 hours
  await kv.set(`room:${id}`, state, { ex: 60 * 60 * 3 });
}

export async function getRoom(id: string): Promise<GameState | null> {
  if (useKV()) return kvGet(id);
  // Purge stale entries in memory store
  const now = Date.now();
  for (const [k, v] of getMemoryRooms()) {
    if (now - v.createdAt > 3 * 60 * 60 * 1000) getMemoryRooms().delete(k);
  }
  return getMemoryRooms().get(id) ?? null;
}

export async function setRoom(id: string, state: GameState): Promise<void> {
  if (useKV()) { await kvSet(id, state); return; }
  getMemoryRooms().set(id, state);
}
