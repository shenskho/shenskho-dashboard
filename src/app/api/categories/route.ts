import { NextResponse } from 'next/server';
import { createCategory, listCategories } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listCategories());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'نام لازم است' }, { status: 400 });
  }
  return NextResponse.json(
    await createCategory(String(body.name).trim(), body.color || 'slate'),
    { status: 201 },
  );
}
