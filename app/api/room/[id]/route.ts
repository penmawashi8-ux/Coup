import { NextResponse } from 'next/server';
import { getRoom } from '@/lib/store';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getRoom(id);
  if (!state) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json(state);
}
