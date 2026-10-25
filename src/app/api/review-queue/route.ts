import { NextResponse } from 'next/server';
import { listReviewQueue } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get('status') || undefined;
  return NextResponse.json(await listReviewQueue(status));
}
