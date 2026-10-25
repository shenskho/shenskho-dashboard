import { NextResponse } from 'next/server';
import { AGENT_RUNNERS, isAgentImplemented } from '@/lib/agents';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** پارامتر مسیر در واقع slug دستیاره (مثل linkedin-content)، نه id دیتابیسی — اسم فولدر فقط برای سازگاری با [id] کنار دستی است */
export async function POST(_req: Request, { params }: Ctx) {
  const { id: slug } = await params;
  if (!isAgentImplemented(slug)) {
    return NextResponse.json(
      { error: 'این دستیار هنوز منطق واقعی نداره — فقط رکورد برنامه‌ریزی‌شده‌ست (فاز ۴ باقی‌مونده).' },
      { status: 400 },
    );
  }
  try {
    const run = await AGENT_RUNNERS[slug]();
    return NextResponse.json(run);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
