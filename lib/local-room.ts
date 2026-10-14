// CPU対戦の途中経過を、このタブの sessionStorage に持たせるための入れ物。
//
// サーバー（Vercel Blob）に1手ごとに書くと Advanced Operations の
// 無料枠（月2,000回）をすぐ使い切るので、共有の必要がないCPU対戦は
// ここで持つ。タブを閉じれば消える。
//
// 読み書きは必ず try/catch で囲む。プライベートウィンドウや
// ストレージを無効にしている環境では例外を投げるため。

import type { GameState } from './types';

export type StoredState = GameState | null;

function key(roomId: string): string {
  return `coup:room:${roomId}`;
}

/**
 * 保存されている続きと、サーバーから来た state の新しいほうを返す。
 * どちらも無ければ null。
 */
export function loadLocalState(roomId: string, serverState: StoredState): StoredState {
  let saved: GameState | null = null;
  try {
    const raw = sessionStorage.getItem(key(roomId));
    if (raw) saved = JSON.parse(raw) as GameState;
  } catch {
    saved = null;
  }
  if (!saved) return serverState;
  if (!serverState) return saved;
  return saved.lastUpdated > serverState.lastUpdated ? saved : serverState;
}

export function saveLocalState(roomId: string, state: GameState): void {
  try {
    sessionStorage.setItem(key(roomId), JSON.stringify(state));
  } catch {
    // 保存できない環境では再読み込みで巻き戻るだけで、遊ぶのには支障がない
  }
}
