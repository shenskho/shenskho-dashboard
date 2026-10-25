import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'نام پروژه لازم است' }, { status: 400 });
  }
  const project = await createProject({
    name: String(body.name).trim(),
    client_name: body.client_name || null,
    color: body.color || 'blue',
  });
  return NextResponse.json(project, { status: 201 });
}
