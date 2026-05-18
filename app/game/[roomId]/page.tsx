import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string>>;
}

export default async function OldGamePage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  redirect(`/r/${roomId}${qs ? `?${qs}` : ''}`);
}
