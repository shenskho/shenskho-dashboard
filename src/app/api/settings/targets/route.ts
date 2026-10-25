import { NextResponse } from 'next/server';
import { getTargets, setTargets } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getTargets());
}

export async function POST(req: Request) {
  const body = await req.json();
  await setTargets({
    daily: body.daily === null || body.daily === '' ? null : Number(body.daily),
    weekly: body.weekly === null || body.weekly === '' ? null : Number(body.weekly),
  });
  return NextResponse.json({ ok: true });
}
