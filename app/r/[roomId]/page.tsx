import { redirect } from 'next/navigation';
import { getRoom } from '@/lib/store';
import GameBoardLoader from '@/components/GameBoardLoader';

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ pid?: string; online?: string }>;
}

export default async function GamePage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const { pid, online } = await searchParams;

  if (!pid) redirect('/');

  // 部屋が引けなくてもここでは弾かない。
  // CPU対戦の続きはクライアントの sessionStorage にあるので、
  // GameBoardLoader に判断を任せる（どちらにも無ければトップへ戻す）。
  const state = await getRoom(roomId);

  return (
    <GameBoardLoader
      roomId={roomId}
      playerId={pid}
      serverState={state}
      isOnline={online === '1'}
    />
  );
}
