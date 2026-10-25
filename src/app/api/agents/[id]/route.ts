import { NextResponse } from 'next/server';
import { updateAgent } from '@/lib/repo';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const patch: { status?: 'planned' | 'active' | 'paused'; schedule_note?: string | null } = {};
  if ('status' in body) patch.status = body.status;
  if ('schedule_note' in body) patch.schedule_note = body.schedule_note;
  await updateAgent(id, patch);
  return NextResponse.json({ ok: true });
}
