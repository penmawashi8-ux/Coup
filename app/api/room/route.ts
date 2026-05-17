import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createGame } from '@/lib/game-engine';
import { setRoom } from '@/lib/store';

export async function POST(req: Request) {
  const body = await req.json();
  const { playerName, cpuCount = 0, mode = 'online' } = body as {
    playerName: string;
    cpuCount?: number;
    mode?: 'cpu' | 'online';
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
  }

  setRoom(roomId, state);
  return NextResponse.json({ roomId, playerId: hostId });
}
