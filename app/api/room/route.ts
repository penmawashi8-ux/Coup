import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createGame } from '@/lib/game-engine';
import { setRoom } from '@/lib/store';
import { addLobbyEntry } from '@/lib/lobby-store';

export async function POST(req: Request) {
  const body = await req.json();
  const { playerName, cpuCount = 0, mode = 'online', password, skipTimeoutSec } = body as {
    playerName: string;
    cpuCount?: number;
    mode?: 'cpu' | 'online';
    password?: string;
    skipTimeoutSec?: number;
  };

  const roomId = uuidv4().slice(0, 6).toUpperCase();
  const hostId = uuidv4();

  const players: Array<{ id: string; name: string; isCPU: boolean }> = [
    { id: hostId, name: playerName, isCPU: false },
  ];
  for (let i = 0; i < cpuCount; i++) {
    players.push({ id: uuidv4(), name: `CPU ${i + 1}`, isCPU: true });
  }

  const state = createGame(players, hostId);

  if (mode === 'online') {
    state.phase = 'lobby';
    state.log = ['ルームを作成しました。友達の参加を待っています...'];
    const trimmedPw = password?.trim();
    if (trimmedPw) state.password = trimmedPw;
    state.isPublic = true;
    if (skipTimeoutSec && skipTimeoutSec > 0) state.skipTimeoutSec = skipTimeoutSec;

    let lobbyError: string | null = null;
    try {
      await addLobbyEntry({
        id: roomId,
        hostName: playerName,
        playerCount: 1,
        hasPassword: !!trimmedPw,
        createdAt: Date.now(),
      });
    } catch (e) {
      lobbyError = String(e);
      console.error('[lobby] addLobbyEntry failed:', e);
    }

    await setRoom(roomId, state, { force: true });
    return NextResponse.json({ roomId, playerId: hostId, lobbyError });
  }

  // CPU対戦は誰とも共有されず、クライアントもポーリングしない。
  // store.ts がこの印を見て blob に書かないようにする。
  state.isCPUOnly = true;
  //
  // 以前はここだけ force で1回書いていた（/r/[roomId] が部屋を引けるように）。
  // その後それは要らなくなっている。
  //   ・/r/[roomId] は部屋が引けなくても弾かず、GameBoardLoader に任せる
  //   ・手を進める /api/room/[id]/action は、CPU対戦なら必ず clientState を使い
  //     保存先を読みにいかない
  //   ・盤面は下で返す state をブラウザが sessionStorage に控える
  // 一方で put() は Blob の advanced operation（無料枠は月2,000回）で、
  // 部屋を作るだけで1回使う。アクセスが1日200件を超えると
  // 作成だけで数日で枠を使い切り、オンライン対戦ごと止まってしまう。
  // 読まれない書き込みにその枠を使う理由がないのでやめる。
  await setRoom(roomId, state);
  // state も返す。サーバー側から部屋を引けなくても、
  // クライアントがこれを持っていればゲームを始められる。
  return NextResponse.json({ roomId, playerId: hostId, state });
}
