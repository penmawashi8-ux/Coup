import { redirect } from 'next/navigation';
import { getRoom } from '@/lib/store';
import GameBoard from '@/components/GameBoard';

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ pid?: string; online?: string }>;
}

export default async function GamePage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const { pid, online } = await searchParams;

  if (!pid) redirect('/');

  const state = await getRoom(roomId);
  if (!state) redirect('/');

  return (
    <GameBoard
      roomId={roomId}
      playerId={pid}
      initialState={state}
      isOnline={online === '1'}
    />
  );
}
