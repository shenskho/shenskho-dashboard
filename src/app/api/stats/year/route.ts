import { NextResponse } from 'next/server';
import { yearHeatmap } from '@/lib/repo';
import { addDays, todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ۳۶۵ روز گذشته برای هیت‌مپ */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const to = sp.get('to') || todayIso();
  const from = addDays(to, -364);
  return NextResponse.json({ from, to, days: await yearHeatmap(from, to) });
}
