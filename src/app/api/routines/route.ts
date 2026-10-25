import { NextResponse } from 'next/server';
import { createRoutine, listRoutines } from '@/lib/repo';
import { todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listRoutines());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'عنوان لازم است' }, { status: 400 });
  }
  const routine = await createRoutine({
    title: String(body.title).trim(),
    category_id: body.category_id ?? null,
    days: body.days ?? '0,1,2,3,4,5,6',
    priority: Number(body.priority ?? 1),
    start_date: body.start_date || todayIso(),
  });
  return NextResponse.json(routine, { status: 201 });
}
