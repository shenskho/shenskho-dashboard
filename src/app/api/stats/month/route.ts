import { NextResponse } from 'next/server';
import { monthStats } from '@/lib/repo';
import { gregorianMonthDays, jalaliMonthDays, todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const mode = sp.get('mode') === 'gregorian' ? 'gregorian' : 'jalali';
  const y = Number(sp.get('y'));
  const m = Number(sp.get('m'));
  if (!y || !m || m < 1 || m > 12) {
    return NextResponse.json({ error: 'سال و ماه نامعتبر' }, { status: 400 });
  }
  const days = mode === 'jalali' ? jalaliMonthDays(y, m) : gregorianMonthDays(y, m);
  return NextResponse.json(await monthStats(days, todayIso()));
}
