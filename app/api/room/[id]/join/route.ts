import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getRoom, setRoom } from '@/lib/store';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { playerName } = await req.json() as { playerName: string };

  const state = getRoom(id);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (state.phase !== 'lobby') return NextResponse.json({ error: 'Game already started' }, { status: 400 });

  const newPlayerId = uuidv4();

  // Add the new human player (keep CPUs at the end)
  const humanPlayers = state.players.filter(p => !p.isCPU);
  const cpuPlayers = state.players.filter(p => p.isCPU);
  const newPlayer = { id: newPlayerId, name: playerName, coins: 2, hand: [], revealed: [], isAlive: true, isCPU: false, connected: true };

  const updated = {
    ...state,
    players: [...humanPlayers, newPlayer, ...cpuPlayers],
    log: [...state.log, `${playerName} が参加しました。`],
    lastUpdated: Date.now(),
  };

  setRoom(id, updated);
  return NextResponse.json({ playerId: newPlayerId });
}
