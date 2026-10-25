import { NextResponse } from 'next/server';
import { listAgentRuns } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get('limit') || '50');
  return NextResponse.json(await listAgentRuns(limit));
}
