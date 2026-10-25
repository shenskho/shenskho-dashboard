'use client';

import { useCallback, useEffect, useState } from 'react';
import MonthChart from '@/components/MonthChart';
import Heatmap from '@/components/Heatmap';
import { useSettings } from '@/components/Providers';
import { isoToJalali, parseIso, todayIso } from '@/lib/date/jalali';
import { fa, monthTitle, shortDate, WEEKDAYS_SHORT } from '@/lib/date/format';
import type { MonthStats, Targets } from '@/lib/types';
import { COLORS } from '@/lib/types';

export default function ChartPage() {
  const { calendar, theme } = useSettings();
  const [ym, setYm] = useState<{ y: number; m: number } | null>(null);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Targets>({ daily: null, weekly: null });
  const [editingTarget, setEditingTarget] = useState(false);
  const [dailyDraft, setDailyDraft] = useState('');
  const [weeklyDraft, setWeeklyDraft] = useState('');

  const loadTargets = useCallback(async () => {
    const res = await fetch('/api/settings/targets', { cache: 'no-store' });
    const t: Targets = await res.json();
    setTargets(t);
    setDailyDraft(t.daily != null ? String(t.daily) : '');
    setWeeklyDraft(t.weekly != null ? String(t.weekly) : '');
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  async function saveTargets(e: React.FormEvent) {
    e.preventDefault();
    const daily = dailyDraft.trim() ? Number(dailyDraft) : null;
    const weekly = weeklyDraft.trim() ? Number(weeklyDraft) : null;
    await fetch('/api/settings/targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ daily, weekly }),
    });
    setTargets({ daily, weekly });
    setEditingTarget(false);
  }

  // با تغییر تقویم، ماه جاری همان تقویم انتخاب می‌شود
  useEffect(() => {
    const iso = todayIso();
    if (calendar === 'jalali') {
      const j = isoToJalali(iso);
      setYm({ y: j.jy, m: j.jm });
    } else {
      const g = parseIso(iso);
      setYm({ y: g.gy, m: g.gm });
    }
  }, [calendar]);

  const load = useCallback(async (y: number, m: number, mode: string) => {
    setLoading(true);
    const res = await fetch(`/api/stats/month?mode=${mode}&y=${y}&m=${m}`, { cache: 'no-store' });
    setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ym) load(ym.y, ym.m, calendar);
  }, [ym, calendar, load]);

  function shift(delta: number) {
    setYm((cur) => {
      if (!cur) return cur;
      let { y, m } = cur;
      m += delta;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return { y, m };
    });
  }

  if (!ym) return null;

  return (
    <div className="flex flex-col gap-5 fade-in">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">چارت ماهانه‌ی عملکرد</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="ماه قبل"
            onClick={() => shift(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <span className="min-w-[130px] text-center text-sm font-medium">{monthTitle(calendar, ym.y, ym.m)}</span>
          <button
            type="button"
            aria-label="ماه بعد"
            onClick={() => shift(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setEditingTarget((v) => !v)}
            className="rounded-lg px-2.5 py-1.5 text-xs"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            هدف‌گذاری
          </button>
        </div>
      </section>

      {editingTarget && (
        <form onSubmit={saveTargets} className="card flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--muted)' }}>
            هدف روزانه (تعداد تسک)
            <input
              type="number"
              min={0}
              value={dailyDraft}
              onChange={(e) => setDailyDraft(e.target.value)}
              placeholder="مثلاً ۵"
              className="w-28 rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--muted)' }}>
            هدف هفتگی (تعداد تسک)
            <input
              type="number"
              min={0}
              value={weeklyDraft}
              onChange={(e) => setWeeklyDraft(e.target.value)}
              placeholder="مثلاً ۳۰"
              className="w-28 rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)' }}
            />
          </label>
          <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
            ذخیره
          </button>
        </form>
      )}

      {loading || !stats ? (
        <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال محاسبه…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="کل تسک‌های انجام‌شده" value={fa(stats.totalDone)} hero />
            <Tile label="میانگین روزانه" value={fa(stats.avgPerDay.toFixed(1))} />
            <Tile
              label="بهترین روز"
              value={stats.bestDay && stats.bestDay.done > 0 ? fa(stats.bestDay.done) : '—'}
              hint={stats.bestDay && stats.bestDay.done > 0 ? shortDate(stats.bestDay.day, calendar) : undefined}
            />
            <Tile
              label="زنجیره‌ی فعلی"
              value={`${fa(stats.currentStreak)} روز`}
              hint={`رکورد: ${fa(stats.longestStreak)} روز`}
            />
          </div>

          <MonthChart
            points={stats.points}
            calendar={calendar}
            average={stats.avgPerDay}
            target={targets.daily}
            title={`تعداد تسک‌های انجام‌شده در هر روز — ${monthTitle(calendar, ym.y, ym.m)}`}
            subtitle={`${fa(stats.activeDays)} روز فعال · نرخ تکمیل ${fa(Math.round(stats.completionRate * 100))}٪`}
          />

          <div className="grid gap-3 md:grid-cols-2">
            {/* تفکیک دسته‌ها */}
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">تفکیک بر اساس دسته</h2>
              {stats.byCategory.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>هنوز داده‌ای برای این ماه نیست.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {stats.byCategory.map((c) => {
                    const max = stats.byCategory[0].done || 1;
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

            {/* روزهای هفته */}
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">میانگین در روزهای هفته</h2>
              <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
                {stats.byWeekday.map((d) => {
                  const avg = d.days ? d.done / d.days : 0;
                  const max = Math.max(1, ...stats.byWeekday.map((x) => (x.days ? x.done / x.days : 0)));
                  return (
                    <div key={d.index} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="tnum text-[10px]" style={{ color: 'var(--muted)' }}>{avg ? fa(avg.toFixed(1)) : '—'}</span>
                      <span
                        className="w-full max-w-[22px] rounded-t-[4px]"
                        style={{ height: `${Math.max(2, (avg / max) * 78)}px`, background: 'var(--accent)' }}
                      />
                      <span className="text-[11px]" style={{ color: 'var(--ink-2)' }}>{WEEKDAYS_SHORT[d.index]}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <Heatmap calendar={calendar} />
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
