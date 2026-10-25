import { NextResponse } from 'next/server';
import { getDay } from '@/lib/repo';
import { todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('day') || todayIso();
  return NextResponse.json(await getDay(day));
}
