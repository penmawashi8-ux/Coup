// Lobby index: tracks open (waiting) rooms so players can discover games.
// Uses a single Blob file in production, global Map in local dev.

import type { LobbyEntry } from './types';

interface LobbyIndex {
  rooms: LobbyEntry[];
}

declare global {
  // eslint-disable-next-line no-var
  var __lobbyRooms: LobbyEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __lobbyBlobUrl: string | undefined;
}

const INDEX_PATH = 'coup-lobby-index.json';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // prune entries older than 2 h

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function memRooms(): LobbyEntry[] {
  if (!global.__lobbyRooms) global.__lobbyRooms = [];
  return global.__lobbyRooms;
}

async function blobRead(): Promise<LobbyEntry[]> {
  const { list } = await import('@vercel/blob');
  try {
    if (global.__lobbyBlobUrl) {
      const res = await fetch(global.__lobbyBlobUrl, { cache: 'no-store' });
      if (res.ok) return ((await res.json() as LobbyIndex).rooms ?? []);
    }
    const { blobs } = await list({ prefix: INDEX_PATH });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].downloadUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json() as LobbyIndex).rooms ?? []);
  } catch {
    return [];
  }
}

async function blobWrite(rooms: LobbyEntry[]): Promise<void> {
  const { put } = await import('@vercel/blob');
  try {
    const result = await put(INDEX_PATH, JSON.stringify({ rooms }), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    global.__lobbyBlobUrl = result.url;
  } catch (e) {
    console.error('[lobby-store] blobWrite failed:', e);
    throw e;
  }
}

export async function getLobbyList(): Promise<LobbyEntry[]> {
  const cutoff = Date.now() - ROOM_TTL_MS;
  if (!useBlob()) return memRooms().filter(r => r.createdAt > cutoff);
  const rooms = await blobRead();
  return rooms.filter(r => r.createdAt > cutoff).sort((a, b) => b.createdAt - a.createdAt);
}

export async function addLobbyEntry(entry: LobbyEntry): Promise<void> {
  if (!useBlob()) {
    global.__lobbyRooms = [...memRooms().filter(r => r.id !== entry.id), entry];
    return;
  }
  const rooms = await blobRead();
  await blobWrite([...rooms.filter(r => r.id !== entry.id), entry]);
}

export async function updateLobbyPlayerCount(id: string, playerCount: number): Promise<void> {
  if (!useBlob()) {
    global.__lobbyRooms = memRooms().map(r => r.id === id ? { ...r, playerCount } : r);
    return;
  }
  const rooms = await blobRead();
  await blobWrite(rooms.map(r => r.id === id ? { ...r, playerCount } : r));
}

export async function removeLobbyEntry(id: string): Promise<void> {
  if (!useBlob()) {
    global.__lobbyRooms = memRooms().filter(r => r.id !== id);
    return;
  }
  const rooms = await blobRead();
  await blobWrite(rooms.filter(r => r.id !== id));
}
