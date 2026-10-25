import { NextResponse } from 'next/server';
import { deleteRoutine, updateRoutine } from '@/lib/repo';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  await updateRoutine(id, await req.json());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteRoutine(id);
  return NextResponse.json({ ok: true });
}
