// State store: uses @vercel/blob when BLOB_READ_WRITE_TOKEN is set (Vercel prod),
// falls back to in-memory Map for local development.

import type { GameState } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __gameRooms: Map<string, GameState> | undefined;
  // eslint-disable-next-line no-var
  var __blobBaseUrl: string | undefined;
  // True once the base URL has been confirmed by put()/list() or a 200 read.
  // Until then a 404 might just mean we guessed the wrong host.
  var __blobBaseUrlVerified: boolean | undefined;
  var __roomListedAt: number | undefined;
  // 部屋ごとの「最後にblobへ書いた時刻」。CPU対戦の間引きに使う。
  var __roomWroteAt: Map<string, number> | undefined;
}

// list() is a Blob *advanced operation*. Game boards poll every 1.5s, so a
// per-request list() for a room that does not exist (stale share link, expired
// room) costs 2,400 operations per hour per open tab. Rate-limit discovery.
const LIST_DISCOVERY_COOLDOWN_MS = 5 * 60 * 1000;

// put() も Blob の *advanced operation*（無料枠は月2,000回）。
//
// CPU対戦は ?online=1 が付かず GameBoard がポーリングしないため、
// 保存したstateが読まれるのはページを再読み込みしたときだけ。
// それなのに1手ごとに put() していたので、1局（50〜150手）で
// 無料枠の数%を使い切っていた。
//
// そこでCPU対戦では書き込みを間引く。間引いても、
// ・部屋の作成時
// ・ゲーム終了時
// ・前回の書き込みから一定時間が経ったとき
// は必ず書くので、再読み込みで戻れる範囲は最大でこの間隔ぶん。
const CPU_GAME_WRITE_INTERVAL_MS = 10 * 1000;

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
      if (res.ok) {
        global.__blobBaseUrlVerified = true;
        return res.json() as Promise<GameState>;
      }
      // Once the base URL is known good, a 404 simply means "no such room".
      if (res.status === 404 && global.__blobBaseUrlVerified) return null;
    }

    // Fallback: discover via list() for non-standard token formats.
    // Advanced operation — at most one per cooldown window per instance.
    const now = Date.now();
    if (now - (global.__roomListedAt ?? 0) < LIST_DISCOVERY_COOLDOWN_MS) return null;
    global.__roomListedAt = now;

    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: blobPath(id), limit: 1 });
    if (blobs.length === 0) return null;
    // Cache the real base URL from the list result URL
    global.__blobBaseUrl = blobs[0].url.replace(`/${blobPath(id)}`, '');
    global.__blobBaseUrlVerified = true;
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
  // put() returns the authoritative URL — trust it over any derived guess.
  global.__blobBaseUrl = result.url.replace(`/${blobPath(id)}`, '');
  global.__blobBaseUrlVerified = true;
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

function getWroteAt(): Map<string, number> {
  if (!global.__roomWroteAt) global.__roomWroteAt = new Map();
  return global.__roomWroteAt;
}

/**
 * CPU対戦のときだけ、blobへの書き込みを間引いてよいか判定する。
 * オンライン対戦は相手がこのblobを読むので、常に書く。
 * isCPUOnly が無い古い部屋も、安全側に倒して常に書く。
 */
function shouldSkipBlobWrite(id: string, state: GameState): boolean {
  if (state.isCPUOnly !== true) return false;
  if (state.phase === 'game_over') return false;

  const now = Date.now();
  const last = getWroteAt().get(id);
  if (last !== undefined && now - last < CPU_GAME_WRITE_INTERVAL_MS) return true;
  return false;
}

export async function setRoom(
  id: string,
  state: GameState,
  opts: { force?: boolean } = {},
): Promise<void> {
  getMemoryRooms().set(id, state);
  if (!useBlob()) return;

  if (!opts.force && shouldSkipBlobWrite(id, state)) return;

  try {
    await blobSet(id, state);
    getWroteAt().set(id, Date.now());
  } catch (e) {
    console.error('[store] blob write failed:', e);
  }
}
