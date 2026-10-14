'use client';

// ゲーム画面の入口。どの state で GameBoard を始めるかを決める。
//
// CPU対戦の途中経過はサーバーに保存していない（Vercel Blob の
// Advanced Operations の無料枠が月2,000回しかなく、1手ごとに書くと
// すぐ尽きるため）。代わりにこのタブの sessionStorage が持っている。
//
// サーバーから来る state は次のどちらか:
//   ・部屋を作ったときの初期状態（blobが生きている場合）
//   ・null（blobが止まっている、または部屋が消えた場合）
// どちらの場合も、保存されている続きのほうが新しければそちらを使う。
// 両方とも無いときだけトップへ戻す。

import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GameBoard from './GameBoard';
import { loadLocalState, type StoredState } from '@/lib/local-room';
import type { GameState } from '@/lib/types';

interface Props {
  roomId: string;
  playerId: string;
  serverState: GameState | null;
  isOnline: boolean;
}

export default function GameBoardLoader({ roomId, playerId, serverState, isOnline }: Props) {
  const router = useRouter();
  // サーバー側描画では sessionStorage を読めないので、まずは
  // サーバーの state のまま描き、描画前の useLayoutEffect で差し替える。
  const [resolved, setResolved] = useState<StoredState>(serverState);

  useLayoutEffect(() => {
    // オンライン対戦の正は常にサーバー側。部屋が無ければ諦める。
    if (isOnline) {
      if (!serverState) router.replace('/');
      return;
    }
    const next = loadLocalState(roomId, serverState);
    if (!next) {
      router.replace('/');
      return;
    }
    // sessionStorage はサーバー側描画では読めないので、描画前のここで取り込む。
    // 入口でマウント時に一度きりの判定であり、連鎖的な再描画は起きないので
    // このルールは外す。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next !== serverState) setResolved(next);
    // 入口なのでマウント時に一度だけ判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!resolved) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
        読み込み中…
      </div>
    );
  }

  return (
    <GameBoard
      roomId={roomId}
      playerId={playerId}
      initialState={resolved}
      isOnline={isOnline}
    />
  );
}
