import { NextResponse } from 'next/server';
import { deleteCategory } from '@/lib/repo';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteCategory(id);
  return NextResponse.json({ ok: true });
}
