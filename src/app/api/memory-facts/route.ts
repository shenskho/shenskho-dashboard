import { NextResponse } from 'next/server';
import { addMemoryFact, listMemoryFacts } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get('status') || undefined;
  return NextResponse.json(await listMemoryFacts(status));
}

/** فقط برای ثبت مستقیم توسط کاربر/ارکستریتور — دستیارها باید از صف تأیید رد بشن */
export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.key || !body?.value) {
    return NextResponse.json({ error: 'key و value لازم است' }, { status: 400 });
  }
  const fact = await addMemoryFact({ key: String(body.key), value: String(body.value), source: 'user' });
  return NextResponse.json(fact, { status: 201 });
}
