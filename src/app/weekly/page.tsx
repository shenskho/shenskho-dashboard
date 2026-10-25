'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/components/Providers';
import { addDays, todayIso } from '@/lib/date/jalali';
import { fa, shortDate } from '@/lib/date/format';
import type { WeekSummary } from '@/lib/types';
import { COLORS } from '@/lib/types';

export default function WeeklyPage() {
  const { calendar, theme } = useSettings();
  const [anchorDay, setAnchorDay] = useState('');
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusDraft, setFocusDraft] = useState<string[]>(['', '', '']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAnchorDay(todayIso());
  }, []);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    const res = await fetch(`/api/weekly?day=${day}`, { cache: 'no-store' });
    const data: WeekSummary = await res.json();
    setSummary(data);
    const f = [data.focus[0] ?? '', data.focus[1] ?? '', data.focus[2] ?? ''];
    setFocusDraft(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (anchorDay) load(anchorDay);
  }, [anchorDay, load]);

  async function saveFocus(e: React.FormEvent) {
    e.preventDefault();
    if (!summary) return;
    const focus = focusDraft.map((f) => f.trim()).filter(Boolean);
    await fetch('/api/weekly', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ week_start: summary.weekStart, focus }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!anchorDay) return null;

  return (
    <div className="flex flex-col gap-5 fade-in">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">مرور هفتگی</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="هفته‌ی قبل"
            onClick={() => setAnchorDay((d) => addDays(d, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          {summary && (
            <span className="text-sm font-medium">
              {shortDate(summary.weekStart, calendar)} تا {shortDate(summary.weekEnd, calendar)}
            </span>
          )}
          <button
            type="button"
            aria-label="هفته‌ی بعد"
            onClick={() => setAnchorDay((d) => addDays(d, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        </div>
      </section>

      {loading || !summary ? (
        <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال محاسبه…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="کل تسک‌های انجام‌شده" value={fa(summary.totalDone)} hero />
            <Tile label="روزهای فعال" value={`${fa(summary.activeDays)} از ۷`} />
            <Tile
              label="بهترین روز"
              value={summary.bestDay && summary.bestDay.done > 0 ? fa(summary.bestDay.done) : '—'}
              hint={summary.bestDay && summary.bestDay.done > 0 ? shortDate(summary.bestDay.day, calendar) : undefined}
            />
            <Tile
              label="نرخ تکمیل"
              value={summary.totalTasks ? `${fa(Math.round((summary.totalDone / summary.totalTasks) * 100))}٪` : '—'}
            />
          </div>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">تفکیک بر اساس دسته</h2>
            {summary.byCategory.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>هنوز داده‌ای برای این هفته نیست.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {summary.byCategory.map((c) => {
                  const max = summary.byCategory[0].done || 1;
                  const color = COLORS[c.color]?.[theme] ?? COLORS.slate[theme];
                  return (
                    <li key={c.id ?? 'none'} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs" style={{ color: 'var(--ink-2)' }}>
                        <span className="ml-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
                        {c.name}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                        <span className="block h-full rounded-full" style={{ width: `${(c.done / max) * 100}%`, background: color }} />
                      </span>
                      <span className="tnum w-8 shrink-0 text-left text-xs" style={{ color: 'var(--ink-2)' }}>{fa(c.done)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <form onSubmit={saveFocus} className="card flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold">تمرکز هفته‌ی بعد (حداکثر ۳ مورد)</h2>
            {focusDraft.map((v, i) => (
              <input
                key={i}
                type="text"
                value={v}
                onChange={(e) => setFocusDraft((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                placeholder={`اولویت ${fa(i + 1)}`}
                className="rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
                style={{ border: '1px solid var(--border)' }}
              />
            ))}
            <div className="flex items-center gap-3">
              <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
                ذخیره
              </button>
              {saved && <span className="text-xs" style={{ color: 'var(--good)' }}>ذخیره شد</span>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, hero }: { label: string; value: string; hint?: string; hero?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className={hero ? 'text-4xl font-semibold leading-snug' : 'text-2xl font-semibold leading-snug'}>{value}</p>
      {hint && <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}
