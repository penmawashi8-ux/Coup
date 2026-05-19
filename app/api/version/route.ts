import { NextResponse } from 'next/server';

// Vercel sets VERCEL_GIT_COMMIT_SHA automatically on each deploy.
// In local dev it's undefined, so we fall back to a static string.
const BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  'dev';

export async function GET() {
  return NextResponse.json({ version: BUILD_VERSION });
}
