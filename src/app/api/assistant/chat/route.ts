import { NextResponse } from 'next/server';
import { runAssistant, type ChatMessage } from '@/lib/assistant/run';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw: unknown = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: 'messages لازم است' }, { status: 400 });
  }
  const messages: ChatMessage[] = raw
    .filter((m): m is ChatMessage => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.text === 'string' && m.text.trim() !== '')
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'آخرین پیام باید از طرف کاربر باشد' }, { status: 400 });
  }

  try {
    return NextResponse.json(await runAssistant(messages));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
