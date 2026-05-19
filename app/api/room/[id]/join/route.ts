import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getRoom, setRoom } from '@/lib/store';
import type { Player } from '@/lib/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { playerName } = await req.json() as { playerName: string };

  const state = await getRoom(id);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (state.phase !== 'lobby') return NextResponse.json({ error: 'Game already started' }, { status: 400 });

  const newPlayerId = uuidv4();
  const newPlayer: Player = {
    id: newPlayerId,
    name: playerName,
    coins: 2,
    hand: [],
    revealed: [],
    isAlive: true,
    isCPU: false,
    connected: true,
  };

  const humanPlayers = state.players.filter(p => !p.isCPU);
  const cpuPlayers = state.players.filter(p => p.isCPU);

  const updated = {
    ...state,
    players: [...humanPlayers, newPlayer, ...cpuPlayers],
    log: [...state.log, `${playerName} が参加しました。`],
    lastUpdated: Date.now(),
  };

  await setRoom(id, updated);
  return NextResponse.json({ playerId: newPlayerId });
}
