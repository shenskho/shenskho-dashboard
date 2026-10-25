import { NextResponse } from 'next/server';
import { setDayMeta } from '@/lib/repo';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.day) return NextResponse.json({ error: 'تاریخ لازم است' }, { status: 400 });
  const { day, ...patch } = body;
  await setDayMeta(String(day), patch);
  return NextResponse.json({ ok: true });
}
