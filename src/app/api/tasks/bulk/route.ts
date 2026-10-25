import { NextResponse } from 'next/server';
import { createTasksBulk } from '@/lib/repo';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.day || !Array.isArray(body?.titles)) {
    return NextResponse.json({ error: 'day و titles لازم است' }, { status: 400 });
  }
  const tasks = await createTasksBulk(body.titles.map(String), {
    day: String(body.day),
    category_id: body.category_id ?? null,
    project_id: body.project_id ?? null,
    priority: body.priority !== undefined ? Number(body.priority) : undefined,
  });
  return NextResponse.json(tasks, { status: 201 });
}
