// Lobby store: tracks open (waiting) rooms so players can discover games.
// Uses a single index blob (coup-lobby-index.json) in production,
// and an in-memory Map for local dev.

import type { LobbyEntry } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __lobbyRooms: Map<string, LobbyEntry> | undefined;
  // eslint-disable-next-line no-var
  var __lobbyIndexUrl: string | undefined;
  // Shared with store.ts — set after any game-state blob write
  // eslint-disable-next-line no-var
  var __blobBaseUrl: string | undefined;
}

const INDEX_PATH = 'coup-lobby-index.json';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN ?? '';
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${blobToken()}` };
}

function memRooms(): Map<string, LobbyEntry> {
  if (!global.__lobbyRooms) global.__lobbyRooms = new Map();
  return global.__lobbyRooms;
}

// Derive private blob base URL from token (same pattern as store.ts).
function deriveBlobBaseUrl(): string | null {
  if (global.__blobBaseUrl) return global.__blobBaseUrl;
  const token = blobToken();
  if (!token) return null;
  const m = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  if (!m) return null;
  const url = `https://${m[1]}.blob.vercel-storage.com`;
  global.__blobBaseUrl = url;
  return url;
}

async function tryFetchIndex(url: string): Promise<LobbyEntry[] | null> {
  try {
    const res = await fetch(`${url}?_=${Date.now()}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json() as { rooms: LobbyEntry[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  } catch {
    return null;
  }
}

async function readIndex(): Promise<LobbyEntry[]> {
  // 1. Use cached lobby index URL (set after any writeIndex call on this instance)
  if (global.__lobbyIndexUrl) {
    const rooms = await tryFetchIndex(global.__lobbyIndexUrl);
    if (rooms !== null) return rooms;
  }

  // 2. Derive URL from blob base URL — works without any prior API call
  const baseUrl = deriveBlobBaseUrl();
  if (baseUrl) {
    const url = `${baseUrl}/${INDEX_PATH}`;
    const rooms = await tryFetchIndex(url);
    if (rooms !== null) {
      global.__lobbyIndexUrl = url;
      return rooms;
    }
  }

  // 3. Cold-start fallback: discover via list()
  const { list } = await import('@vercel/blob');
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (blobs.length === 0) return [];
    global.__lobbyIndexUrl = blobs[0].url;
    const rooms = await tryFetchIndex(blobs[0].url);
    return rooms ?? [];
  } catch {
    return [];
  }
}

async function writeIndex(rooms: LobbyEntry[]): Promise<void> {
  const { put } = await import('@vercel/blob');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' };
  const result = await put(INDEX_PATH, JSON.stringify({ rooms }), opts);
  global.__lobbyIndexUrl = result.url;
  if (!global.__blobBaseUrl) {
    global.__blobBaseUrl = result.url.replace(`/${INDEX_PATH}`, '');
  }
}

export async function getLobbyList(): Promise<LobbyEntry[]> {
  const cutoff = Date.now() - ROOM_TTL_MS;

  if (!useBlob()) {
    return Array.from(memRooms().values())
      .filter(r => r.createdAt > cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const rooms = await readIndex();
    return rooms
      .filter(r => r.createdAt > cutoff)
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
  const cutoff = Date.now() - ROOM_TTL_MS;
  const existing = await readIndex();
  const filtered = existing.filter(r => r.createdAt > cutoff && r.id !== entry.id);
  await writeIndex([...filtered, entry]);
}

export async function updateLobbyPlayerCount(id: string, playerCount: number): Promise<void> {
  if (!useBlob()) {
    const e = memRooms().get(id);
    if (e) memRooms().set(id, { ...e, playerCount });
    return;
  }
  try {
    const existing = await readIndex();
    const updated = existing.map(r => r.id === id ? { ...r, playerCount } : r);
    await writeIndex(updated);
  } catch (e) {
    console.error('[lobby-store] updateLobbyPlayerCount failed:', e);
  }
}

export async function removeLobbyEntry(id: string): Promise<void> {
  if (!useBlob()) {
    memRooms().delete(id);
    return;
  }
  try {
    const existing = await readIndex();
    const filtered = existing.filter(r => r.id !== id);
    await writeIndex(filtered);
  } catch (e) {
    console.error('[lobby-store] removeLobbyEntry failed:', e);
  }
}
