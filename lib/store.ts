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

function blobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN ?? '';
}

// Derive blob base URL from token.
// Private stores: https://{storeId}.blob.vercel-storage.com
// Public stores:  https://{storeId}.public.blob.vercel-storage.com
// We try private first; fall back to public if the store allows it.
function deriveBaseUrl(): string | null {
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

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${blobToken()}` };
}

async function blobGet(id: string): Promise<GameState | null> {
  try {
    const baseUrl = deriveBaseUrl();
    if (baseUrl) {
      const res = await fetch(`${baseUrl}/${blobPath(id)}?_=${Date.now()}`, {
        cache: 'no-store',
        headers: authHeaders(),
      });
      if (res.ok) return res.json() as Promise<GameState>;
      // Don't short-circuit on 404 — fall through to list() in case the derived URL is stale/wrong
    }
    // Fallback: discover via list() for non-standard token formats
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: blobPath(id) });
    if (blobs.length === 0) return null;
    // Cache the real base URL from the list result URL
    global.__blobBaseUrl = blobs[0].url.replace(`/${blobPath(id)}`, '');
    const res = await fetch(`${blobs[0].url}?_=${Date.now()}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<GameState>;
  } catch {
    return null;
  }
}

async function blobSet(id: string, state: GameState): Promise<void> {
  const { put } = await import('@vercel/blob');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' };
  const result = await put(blobPath(id), JSON.stringify(state), opts);
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
  if (useBlob()) {
    try {
      await blobSet(id, state);
    } catch (e) {
      console.error('[store] blob write failed:', e);
    }
  }
}
