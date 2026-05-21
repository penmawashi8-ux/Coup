import { NextResponse } from 'next/server';
import { getLobbyList } from '@/lib/lobby-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rooms = await getLobbyList();
  return NextResponse.json(rooms, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
