import { NextResponse } from 'next/server';
import { getLobbyList } from '@/lib/lobby-store';

export async function GET() {
  const rooms = await getLobbyList();
  return NextResponse.json(rooms);
}
