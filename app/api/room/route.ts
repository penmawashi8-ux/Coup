import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createGame } from '@/lib/game-engine';
import { setRoom } from '@/lib/store';

export async function POST(req: Request) {
  const body = await req.json();
  const { playerName, cpuCount = 0, totalPlayers = 2 } = body as {
    playerName: string;
    cpuCount?: number;
    totalPlayers?: number;
  };

  const roomId = uuidv4().slice(0, 6).toUpperCase();
  const hostId = uuidv4();

  const players: Array<{ id: string; name: string; isCPU: boolean }> = [
    { id: hostId, name: playerName, isCPU: false },
  ];

  // Add CPU players immediately if specified
  for (let i = 0; i < cpuCount; i++) {
    players.push({ id: uuidv4(), name: `CPU ${i + 1}`, isCPU: true });
  }

  const state = createGame(players, hostId);
  // Override phase to lobby if waiting for more human players
  const humanSlots = totalPlayers - cpuCount;
  if (humanSlots > 1) {
    state.phase = 'lobby';
  }
  // Store total player capacity info in log
  state.log = [`Room created. Waiting for ${humanSlots} human player(s)...`];

  setRoom(roomId, state);

  return NextResponse.json({ roomId, playerId: hostId });
}
