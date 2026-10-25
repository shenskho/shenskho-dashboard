'use client';

import { useEffect, useRef, useState } from 'react';

type Action = { tool: string; ok: boolean; summary: string };
type Pending = { id: string; tool: string; args: Record<string, unknown>; summary: string };
type Msg = {
  role: 'user' | 'assistant';
  text: string;
  actions?: Action[];
  pending?: Pending[];
  error?: boolean;
  meta?: string;
};

const SUGGESTIONS = [
  'فردا سه تا تسک اضافه کن: جلسه با مشتری، نوشتن گزارش، ورزش',
  'یه روتین «مطالعه ۳۰ دقیقه» برای شنبه تا چهارشنبه بساز',
  'تسک‌های امروزم رو نشونم بده',
  'هدف روزانه رو بذار ۵ تا',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطای ناشناخته');
      setMessages([
        ...next,
        {
          role: 'assistant',
          text: data.reply || (data.pending?.length ? 'منتظر تأیید شما هستم.' : 'انجام شد.'),
          actions: data.actions,
          pending: data.pending,
          meta: data.provider ? `${data.provider} · ${data.model}` : undefined,
        },
      ]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', text: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(msgIndex: number, p: Pending, approve: boolean) {
    let note: Action = { tool: p.tool, ok: false, summary: `انصراف: ${p.summary}` };
    if (approve) {
      const res = await fetch('/api/assistant/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool: p.tool, args: p.args }),
      });
      const data = await res.json().catch(() => ({}));
      note = { tool: p.tool, ok: res.ok && data.ok !== false, summary: data.summary || data.error || 'خطا' };
    }
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, pending: m.pending?.filter((x) => x.id !== p.id), actions: [...(m.actions ?? []), note] } : m,
      ),
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>دستیار هوشمند</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-2)' }}>
          به زبان خودت بگو چی می‌خوای؛ تسک، روتین، پروژه و هدف‌ها رو برات مدیریت می‌کنم. حذف‌ها فقط با تأیید تو انجام می‌شن.
        </p>
      </div>

      <div
        className="flex min-h-[50vh] flex-col gap-3 rounded-2xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>چند نمونه برای شروع:</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full px-3 py-1.5 text-start text-sm transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-start' : 'items-end'}`}>
            <div
              className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-7"
              style={{
                background: m.error ? 'transparent' : m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)',
                border: m.error ? '1px solid var(--crit)' : '1px solid var(--border)',
                color: m.error ? 'var(--crit)' : 'var(--ink)',
              }}
            >
              {m.text}
            </div>

            {m.actions?.map((a, j) => (
              <div
                key={j}
                className="max-w-[85%] rounded-lg px-3 py-1 text-xs"
                style={{ background: 'var(--surface-2)', color: a.ok ? 'var(--good)' : 'var(--crit)', border: '1px solid var(--border)' }}
              >
                {a.ok ? '✓' : '✕'} {a.summary}
              </div>
            ))}

            {m.pending?.map((p) => (
              <div
                key={p.id}
                className="flex max-w-[85%] flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--crit)', color: 'var(--ink)' }}
              >
                <span>{p.summary}</span>
                <button
                  type="button"
                  onClick={() => decide(i, p, true)}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: 'var(--crit)', color: '#fff' }}
                >
                  تأیید حذف
                </button>
                <button
                  type="button"
                  onClick={() => decide(i, p, false)}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ border: '1px solid var(--border-strong)', color: 'var(--ink-2)' }}
                >
                  انصراف
                </button>
              </div>
            ))}

            {m.meta && (
              <div className="text-[11px]" style={{ color: 'var(--muted)' }} dir="ltr">
                {m.meta}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="self-end text-sm" style={{ color: 'var(--muted)' }}>
            در حال فکر کردن…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="مثلاً: فردا جلسه با مشتری رو اضافه کن و تسک‌های دیروز که تموم شدن رو تیک بزن…"
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink)' }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          ارسال
        </button>
      </form>
    </div>
  );
}
