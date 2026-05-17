import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getRoom, setRoom } from '@/lib/store';
import { createGame } from '@/lib/game-engine';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { playerName } = await req.json() as { playerName: string };

  const state = getRoom(id);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (state.phase !== 'lobby') return NextResponse.json({ error: 'Game already started' }, { status: 400 });

  const newPlayerId = uuidv4();
  const humanPlayers = state.players.filter(p => !p.isCPU);
  const cpuPlayers = state.players.filter(p => p.isCPU);

  const allPlayers = [
    ...humanPlayers,
    { id: newPlayerId, name: playerName, isCPU: false },
    ...cpuPlayers,
  ];

  // Re-create game with new player list
  const newState = createGame(
    allPlayers.map(p => ({ id: p.id, name: p.name, isCPU: p.isCPU })),
    state.hostId
  );
  newState.id = state.id;
  newState.phase = 'lobby';

  // Check if we have enough players to start (infer from original log)
  // Start automatically if 2+ players
  if (allPlayers.filter(p => !p.isCPU).length >= 2) {
    const started = createGame(
      allPlayers.map(p => ({ id: p.id, name: p.name, isCPU: p.isCPU })),
      state.hostId
    );
    started.id = state.id;
    setRoom(id, started);
    return NextResponse.json({ playerId: newPlayerId, started: true });
  }

  setRoom(id, newState);
  return NextResponse.json({ playerId: newPlayerId, started: false });
}
