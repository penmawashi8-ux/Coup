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
// 最初は「10秒に1回まで」の間引きにしたが、これは効かなかった。
// 最後に書いた時刻を global に持っていたのに、Vercelのサーバーレスは
// リクエストごとに別のインスタンスへ割り振られることがあり、
// 新しいインスタンスでは記録が空なので毎回「初回」と判定されてしまう。
//
// そこでCPU対戦では部屋の作成時以外は blob に書かないことにした。
// 途中経過はクライアント側（sessionStorage）が持つので、
// 再読み込みしても続きから再開できる。
// → components/GameBoard.tsx の saveLocalState / loadLocalState

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

/**
 * CPU対戦は誰とも共有されず、クライアントがポーリングもしないので、
 * 途中経過を blob に残す必要がない。部屋を作るときの1回だけ書く
 * （force=true。これが無いと /r/[roomId] が部屋を見つけられない）。
 *
 * オンライン対戦は相手がこの blob を読むので常に書く。
 * isCPUOnly が無い古い部屋も、安全側に倒して常に書く。
 */
function shouldSkipBlobWrite(state: GameState): boolean {
  return state.isCPUOnly === true;
}

export async function setRoom(
  id: string,
  state: GameState,
  opts: { force?: boolean } = {},
): Promise<void> {
  getMemoryRooms().set(id, state);
  if (!useBlob()) return;

  if (!opts.force && shouldSkipBlobWrite(state)) return;

  try {
    await blobSet(id, state);
  } catch (e) {
    console.error('[store] blob write failed:', e);
  }
}
