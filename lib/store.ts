// State store: uses @vercel/blob when BLOB_READ_WRITE_TOKEN is set (Vercel prod),
// falls back to in-memory Map for local development.

import type { GameState } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __gameRooms: Map<string, GameState> | undefined;
  // eslint-disable-next-line no-var
  var __blobBaseUrl: string | undefined;
}

function getMemoryRooms(): Map<string, GameState> {
  if (!global.__gameRooms) global.__gameRooms = new Map();
  return global.__gameRooms;
}

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function blobPath(id: string): string {
  return `coup-room-${id}.json`;
}

async function blobGet(id: string): Promise<GameState | null> {
  const { list } = await import('@vercel/blob');
  try {
    // Use cached base URL for direct fetch (faster)
    if (global.__blobBaseUrl) {
      const res = await fetch(`${global.__blobBaseUrl}/${blobPath(id)}`, { cache: 'no-store' });
      if (res.ok) return res.json() as Promise<GameState>;
    }
    // Fall back to listing blobs
    const { blobs } = await list({ prefix: blobPath(id) });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<GameState>;
  } catch {
    return null;
  }
}

async function blobSet(id: string, state: GameState): Promise<void> {
  const { put } = await import('@vercel/blob');
  const result = await put(blobPath(id), JSON.stringify(state), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
  // Cache the base URL for faster reads
  if (!global.__blobBaseUrl) {
    global.__blobBaseUrl = result.url.replace(`/${blobPath(id)}`, '');
  }
}

export async function getRoom(id: string): Promise<GameState | null> {
  // Always check memory cache first (same instance hits)
  const cached = getMemoryRooms().get(id);
  if (cached) return cached;

  if (useBlob()) {
    const state = await blobGet(id);
    if (state) getMemoryRooms().set(id, state);
    return state;
  }

  // Local dev: in-memory only
  const now = Date.now();
  for (const [k, v] of getMemoryRooms()) {
    if (now - v.createdAt > 3 * 60 * 60 * 1000) getMemoryRooms().delete(k);
  }
  return getMemoryRooms().get(id) ?? null;
}

export async function setRoom(id: string, state: GameState): Promise<void> {
  getMemoryRooms().set(id, state);
  if (useBlob()) await blobSet(id, state);
}
