import { NextResponse } from 'next/server';
import { createTask } from '@/lib/repo';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.title?.trim() || !body?.day) {
    return NextResponse.json({ error: 'عنوان و تاریخ لازم است' }, { status: 400 });
  }
  const task = await createTask({
    title: String(body.title).trim(),
    day: String(body.day),
    category_id: body.category_id ?? null,
    priority: Number(body.priority ?? 1),
    notes: body.notes ?? null,
  });
  return NextResponse.json(task, { status: 201 });
}
