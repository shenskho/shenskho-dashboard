import { NextResponse } from 'next/server';
import { decideReviewItem } from '@/lib/repo';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const decision = body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision باید approved یا rejected باشد' }, { status: 400 });
  }
  await decideReviewItem(id, decision);
  return NextResponse.json({ ok: true });
}
