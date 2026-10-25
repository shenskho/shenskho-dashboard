import { NextResponse } from 'next/server';
import { executeConfirmed } from '@/lib/assistant/tools';

export const runtime = 'nodejs';

/** اجرای عملیات حذفی که دستیار پیشنهاد داده و کاربر در رابط تأیید کرده */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.tool !== 'string' || typeof body?.args !== 'object' || body.args === null) {
    return NextResponse.json({ error: 'tool و args لازم است' }, { status: 400 });
  }
  const outcome = await executeConfirmed(body.tool, body.args as Record<string, unknown>);
  return NextResponse.json({ ok: outcome.ok, summary: outcome.summary }, { status: outcome.ok ? 200 : 400 });
}
