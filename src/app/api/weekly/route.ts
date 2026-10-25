import { NextResponse } from 'next/server';
import { getWeekSummary, setWeeklyFocus } from '@/lib/repo';
import { todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('day') || todayIso();
  return NextResponse.json(await getWeekSummary(day));
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.week_start || !Array.isArray(body?.focus)) {
    return NextResponse.json({ error: 'week_start و focus لازم است' }, { status: 400 });
  }
  await setWeeklyFocus(String(body.week_start), body.focus.map(String));
  return NextResponse.json({ ok: true });
}
