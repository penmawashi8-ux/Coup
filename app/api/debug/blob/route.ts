import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const result: Record<string, unknown> = {
    hasToken,
    tokenPrefix: hasToken ? process.env.BLOB_READ_WRITE_TOKEN!.slice(0, 12) + '...' : null,
  };

  if (!hasToken) {
    return NextResponse.json({ ...result, error: 'BLOB_READ_WRITE_TOKEN not set — using in-memory only' });
  }

  try {
    const { put, list, del } = await import('@vercel/blob');

    // Write test blob
    const testKey = `coup-debug-test-${Date.now()}.json`;
    const putResult = await put(testKey, JSON.stringify({ ok: true, ts: Date.now() }), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    result.putUrl = putResult.url;

    // Read it back
    const fetchRes = await fetch(putResult.url, { cache: 'no-store' });
    result.fetchStatus = fetchRes.status;
    result.fetchBody = fetchRes.ok ? await fetchRes.json() : null;

    // List
    const { blobs } = await list({ prefix: 'coup-debug-test-' });
    result.listCount = blobs.length;

    // Cleanup
    await del(putResult.url);
    result.deleted = true;

    // Also check for existing lobby blobs
    const { blobs: lobbyBlobs } = await list({ prefix: 'coup-lobby-' });
    result.lobbyBlobCount = lobbyBlobs.length;
    result.lobbyBlobKeys = lobbyBlobs.map(b => b.pathname);

    // Also check for existing room blobs
    const { blobs: roomBlobs } = await list({ prefix: 'coup-room-' });
    result.roomBlobCount = roomBlobs.length;
    result.roomBlobKeys = roomBlobs.map(b => b.pathname);

    result.status = 'ok';
  } catch (e) {
    result.error = String(e);
    result.status = 'error';
  }

  return NextResponse.json(result);
}
