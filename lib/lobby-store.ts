// Lobby store: tracks open (waiting) rooms so players can discover games.
// Uses a single index blob (coup-lobby-index.json) in production,
// and an in-memory Map for local dev.

import type { LobbyEntry } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __lobbyRooms: Map<string, LobbyEntry> | undefined;
  // Only ever set to a URL we know is real: one returned by put()/list(),
  // or one that answered a fetch with 200. A 404 from such a URL is then
  // trustworthy ("no open rooms") and needs no list() to confirm.
  // eslint-disable-next-line no-var
  var __lobbyIndexUrl: string | undefined;
  var __lobbyIndexListedAt: number | undefined;
  // Shared with store.ts — set after any game-state blob write
  // eslint-disable-next-line no-var
  var __blobBaseUrl: string | undefined;
}

const INDEX_PATH = 'coup-lobby-index.json';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
// list() is a Blob *advanced operation*. The lobby page polls /api/lobby every
// 3s, so a per-request list() costs 1,200 operations per hour per open tab.
// Discovery only has to run when the derived URL is wrong, so rate-limit it.
const LIST_DISCOVERY_COOLDOWN_MS = 5 * 60 * 1000;

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
  // Private store blobs still use the .public. CDN hostname; auth is enforced via the token.
  const url = `https://${m[1]}.public.blob.vercel-storage.com`;
  global.__blobBaseUrl = url;
  return url;
}

// 'missing' = the store answered 404: the index blob does not exist.
// 'error'   = we could not tell (network failure, auth rejection, bad URL).
async function tryFetchIndex(url: string): Promise<LobbyEntry[] | 'missing' | 'error'> {
  try {
    const res = await fetch(`${url}?_=${Date.now()}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.status === 404) return 'missing';
    if (!res.ok) return 'error';
    const data = await res.json() as { rooms: LobbyEntry[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  } catch {
    return 'error';
  }
}

// forceDiscover: skip the list() cooldown. Used by the write paths, which run
// once per room mutation (not per poll) and must not overwrite a real index
// with an empty one just because discovery was on cooldown.
async function readIndex(forceDiscover = false): Promise<LobbyEntry[]> {
  // 1. Known-good index URL (from a previous 200, or from put()/list()).
  if (global.__lobbyIndexUrl) {
    const rooms = await tryFetchIndex(global.__lobbyIndexUrl);
    if (Array.isArray(rooms)) return rooms;
    // 404 on a URL we know is real means there are simply no open rooms.
    if (rooms === 'missing') return [];
    // Anything else: the cached URL is unusable, fall through to re-discover.
    global.__lobbyIndexUrl = undefined;
  }

  // 2. URL derived from the token — no API call needed. A 200 promotes it.
  const baseUrl = deriveBlobBaseUrl();
  if (baseUrl) {
    const url = `${baseUrl}/${INDEX_PATH}`;
    const rooms = await tryFetchIndex(url);
    if (Array.isArray(rooms)) {
      global.__lobbyIndexUrl = url;
      return rooms;
    }
  }

  // 3. Cold-start fallback: discover via list(). Costs an advanced operation,
  //    so run it at most once per LIST_DISCOVERY_COOLDOWN_MS per instance.
  //    While on cooldown the lobby reads as empty, which is the correct answer
  //    in the common case (step 2 returned 404 = no index blob yet).
  const now = Date.now();
  if (!forceDiscover && now - (global.__lobbyIndexListedAt ?? 0) < LIST_DISCOVERY_COOLDOWN_MS) {
    return [];
  }
  global.__lobbyIndexListedAt = now;

  const { list } = await import('@vercel/blob');
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (blobs.length === 0) return [];
    global.__lobbyIndexUrl = blobs[0].url;
    const rooms = await tryFetchIndex(blobs[0].url);
    return Array.isArray(rooms) ? rooms : [];
  } catch {
    return [];
  }
}

async function writeIndex(rooms: LobbyEntry[]): Promise<void> {
  const { put } = await import('@vercel/blob');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' };
  const result = await put(INDEX_PATH, JSON.stringify({ rooms }), opts);
  // put() returns the authoritative URL — trust it over any derived guess.
  global.__lobbyIndexUrl = result.url;
  global.__blobBaseUrl = result.url.replace(`/${INDEX_PATH}`, '');
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
  const existing = await readIndex(true);
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
    const existing = await readIndex(true);
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
    const existing = await readIndex(true);
    const filtered = existing.filter(r => r.id !== id);
    await writeIndex(filtered);
  } catch (e) {
    console.error('[lobby-store] removeLobbyEntry failed:', e);
  }
}
