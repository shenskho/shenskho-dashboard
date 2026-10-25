import { NextResponse } from 'next/server';
import { importAll } from '@/lib/repo';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  if (typeof body !== 'object' || body === null || !('tasks' in body)) {
    return NextResponse.json({ error: 'فایل بکاپ نامعتبر است' }, { status: 400 });
  }
  await importAll(body);
  return NextResponse.json({ ok: true });
}
