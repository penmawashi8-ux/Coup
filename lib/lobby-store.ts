// Lobby store: tracks open (waiting) rooms so players can discover games.
// Uses per-room blob files (same pattern as store.ts) in production,
// and an in-memory Map for local dev.

import type { LobbyEntry } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __lobbyRooms: Map<string, LobbyEntry> | undefined;
  // eslint-disable-next-line no-var
  var __lobbyBlobBaseUrl: string | undefined;
}

const LOBBY_PREFIX = 'coup-lobby-';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function memRooms(): Map<string, LobbyEntry> {
  if (!global.__lobbyRooms) global.__lobbyRooms = new Map();
  return global.__lobbyRooms;
}

function lobbyPath(id: string): string {
  return `${LOBBY_PREFIX}${id}.json`;
}

export async function getLobbyList(): Promise<LobbyEntry[]> {
  const cutoff = Date.now() - ROOM_TTL_MS;

  if (!useBlob()) {
    return Array.from(memRooms().values())
      .filter(r => r.createdAt > cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const { list } = await import('@vercel/blob');
  try {
    // Collect all blobs across pages (handles pagination)
    const allBlobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
    let cursor: string | undefined = undefined;
    for (;;) {
      const result = await list({ prefix: LOBBY_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
      allBlobs.push(...result.blobs);
      if (!result.hasMore || !result.cursor) break;
      cursor = result.cursor;
    }

    const entries = await Promise.all(
      allBlobs.map(async (blob) => {
        try {
          // Use blob.url (CDN) with cache-busting to ensure fresh content
          const res = await fetch(`${blob.url}?_=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (!res.ok) return null;
          return await res.json() as LobbyEntry;
        } catch {
          return null;
        }
      })
    );
    return entries
      .filter((e): e is LobbyEntry => e !== null && e.createdAt > cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e) {
    console.error('[lobby-store] getLobbyList failed:', e);
    return [];
  }
}

export async function addLobbyEntry(entry: LobbyEntry): Promise<void> {
  if (!useBlob()) {
    memRooms().set(entry.id, entry);
    return;
  }
  const { put } = await import('@vercel/blob');
  await put(lobbyPath(entry.id), JSON.stringify(entry), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export async function updateLobbyPlayerCount(id: string, playerCount: number): Promise<void> {
  if (!useBlob()) {
    const e = memRooms().get(id);
    if (e) memRooms().set(id, { ...e, playerCount });
    return;
  }

  const { put, list } = await import('@vercel/blob');
  try {
    // Fetch current entry
    let existing: LobbyEntry | null = null;
    if (global.__lobbyBlobBaseUrl) {
      const res = await fetch(`${global.__lobbyBlobBaseUrl}/${lobbyPath(id)}`, { cache: 'no-store' });
      if (res.ok) existing = await res.json() as LobbyEntry;
    }
    if (!existing) {
      const { blobs } = await list({ prefix: lobbyPath(id) });
      if (blobs.length === 0) return;
      const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
      if (res.ok) existing = await res.json() as LobbyEntry;
    }
    if (!existing) return;

    const result = await put(lobbyPath(id), JSON.stringify({ ...existing, playerCount }), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    if (!global.__lobbyBlobBaseUrl) {
      global.__lobbyBlobBaseUrl = result.url.replace(`/${lobbyPath(id)}`, '');
    }
  } catch (e) {
    console.error('[lobby-store] updateLobbyPlayerCount failed:', e);
  }
}

export async function removeLobbyEntry(id: string): Promise<void> {
  if (!useBlob()) {
    memRooms().delete(id);
    return;
  }
  const { del, list } = await import('@vercel/blob');
  try {
    const { blobs } = await list({ prefix: lobbyPath(id) });
    if (blobs.length > 0) await del(blobs[0].url);
  } catch (e) {
    console.error('[lobby-store] removeLobbyEntry failed:', e);
  }
}
