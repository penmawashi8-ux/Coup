import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const hasToken = !!token;
  const result: Record<string, unknown> = {
    hasToken,
    tokenPrefix: hasToken ? token.slice(0, 16) + '...' : null,
  };

  // Derive base URL the same way store.ts / lobby-store.ts do
  const m = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  result.derivedBaseUrl = m ? `https://${m[1]}.blob.vercel-storage.com` : null;

  if (!hasToken) {
    return NextResponse.json({ ...result, error: 'BLOB_READ_WRITE_TOKEN not set — using in-memory only' });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { put, list, del } = await import('@vercel/blob') as any;
    const authHeader = { Authorization: `Bearer ${token}` };

    // ── 1. Basic write/read/delete cycle ──
    const testKey = `coup-debug-test-${Date.now()}.json`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putResult = await put(testKey, JSON.stringify({ ok: true, ts: Date.now() }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    result.putUrl = putResult.url;

    const fetchRes = await fetch(`${putResult.url}?_=${Date.now()}`, { cache: 'no-store', headers: authHeader });
    result.fetchStatus = fetchRes.status;
    result.fetchOk = fetchRes.ok;
    if (fetchRes.ok) result.fetchBody = await fetchRes.json();

    await del(putResult.url);
    result.deleted = true;

    // ── 2. Simulate addLobbyEntry (write index) ──
    const INDEX_PATH = 'coup-lobby-index.json';
    const testEntry = {
      id: 'DEBUG0',
      hostName: 'debug-test',
      playerCount: 1,
      hasPassword: false,
      createdAt: Date.now(),
    };
    let indexWriteError: string | null = null;
    let indexWriteUrl: string | null = null;
    try {
      const existingEntries: unknown[] = [];
      // Simulate readIndex → cold start path: just write []
      const indexPut = await put(
        INDEX_PATH,
        JSON.stringify({ rooms: [testEntry] }),
        { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' },
      );
      indexWriteUrl = indexPut.url;
      result.indexWriteUrl = indexWriteUrl;
      void existingEntries; // suppress unused warning
    } catch (e) {
      indexWriteError = String(e);
    }
    result.indexWriteError = indexWriteError;

    // ── 3. Simulate getLobbyList (read index) ──
    let indexReadError: string | null = null;
    let indexReadRooms: unknown = null;
    if (indexWriteUrl) {
      try {
        const readRes = await fetch(`${indexWriteUrl}?_=${Date.now()}`, { cache: 'no-store', headers: authHeader });
        result.indexReadStatus = readRes.status;
        if (readRes.ok) {
          const body = await readRes.json() as { rooms: unknown };
          indexReadRooms = body.rooms;
        }
      } catch (e) {
        indexReadError = String(e);
      }
    }
    result.indexReadRooms = indexReadRooms;
    result.indexReadError = indexReadError;

    // ── 4. Test derived-URL read (the readIndex() primary path) ──
    if (result.derivedBaseUrl) {
      const derivedUrl = `${result.derivedBaseUrl}/${INDEX_PATH}?_=${Date.now()}`;
      try {
        const derivedRes = await fetch(derivedUrl, { cache: 'no-store', headers: authHeader });
        result.derivedFetchStatus = derivedRes.status;
        result.derivedFetchOk = derivedRes.ok;
        if (derivedRes.ok) result.derivedFetchBody = await derivedRes.json();
      } catch (e) {
        result.derivedFetchError = String(e);
      }
    }

    // ── 5. Cleanup test index (restore previous if any) ──
    // Just remove the debug entry; if real entries existed they'd be lost, so
    // only delete if the content is our debug-only content
    if (indexWriteUrl) {
      try {
        await del(indexWriteUrl);
        result.indexDeleted = true;
      } catch {
        result.indexDeleted = false;
      }
    }

    // ── 6. Inventory of existing blobs ──
    const { blobs: lobbyBlobs } = await list({ prefix: 'coup-lobby-' });
    result.lobbyBlobCount = lobbyBlobs.length;
    result.lobbyBlobPaths = lobbyBlobs.map((b: { pathname: string }) => b.pathname);

    const { blobs: roomBlobs } = await list({ prefix: 'coup-room-' });
    result.roomBlobCount = roomBlobs.length;
    result.roomBlobPaths = roomBlobs.map((b: { pathname: string }) => b.pathname);

    result.status = 'ok';
  } catch (e) {
    result.error = String(e);
    result.status = 'error';
  }

  return NextResponse.json(result, { status: 200 });
}
