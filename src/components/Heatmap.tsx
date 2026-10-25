'use client';

import { useEffect, useState } from 'react';
import { addDays, weekdayIndex } from '@/lib/date/jalali';
import { fa, shortDate, WEEKDAYS_SHORT, type CalendarMode } from '@/lib/date/format';

type DayCount = { day: string; done_count: number; total_count: number };

/** پله‌های آبی از روشن به تیره — نمایش شدت (تعداد تسک انجام‌شده) */
const STEPS_DARK = ['#232322', '#184f95', '#256abf', '#3987e5', '#6da7ec'];
const STEPS_LIGHT = ['#f2f2ef', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab'];

export default function Heatmap({ calendar }: { calendar: CalendarMode }) {
  const [data, setData] = useState<{ from: string; to: string; days: DayCount[] } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark');
    fetch('/api/stats/year', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return null;

  const steps = theme === 'dark' ? STEPS_DARK : STEPS_LIGHT;
  const map = new Map(data.days.map((d) => [d.day, d.done_count]));
  const max = Math.max(1, ...data.days.map((d) => d.done_count));

  // ستون‌ها = هفته‌ها؛ برای راست‌چینی، جدیدترین هفته سمت چپ نمایش داده می‌شود
  const cells: { day: string; count: number }[] = [];
  let cursor = data.from;
  // عقب‌گرد تا شنبه‌ی آن هفته
  cursor = addDays(cursor, -weekdayIndex(cursor));
  while (cursor <= data.to) {
    cells.push({ day: cursor, count: map.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  const weeks: { day: string; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function shade(count: number) {
    if (count === 0) return steps[0];
    const ratio = count / max;
    if (ratio <= 0.25) return steps[1];
    if (ratio <= 0.5) return steps[2];
    if (ratio <= 0.75) return steps[3];
    return steps[4];
  }

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-semibold">۳۶۵ روز گذشته</h2>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ direction: 'ltr', minWidth: 'min-content' }}>
          <div className="flex flex-col gap-[3px] pl-1">
            {WEEKDAYS_SHORT.map((d, i) => (
              <span key={d} className="h-[11px] text-[9px] leading-[11px]" style={{ color: 'var(--muted)', visibility: i % 2 ? 'visible' : 'hidden' }}>
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].day} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => {
                const cell = week[i];
                if (!cell || cell.day > data.to) return <span key={i} className="h-[11px] w-[11px]" />;
                return (
                  <span
                    key={cell.day}
                    title={`${shortDate(cell.day, calendar)} — ${fa(cell.count)} تسک`}
                    className="h-[11px] w-[11px] rounded-[2px]"
                    style={{ background: shade(cell.count) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
        <span>کمتر</span>
        {steps.map((s) => (
          <span key={s} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: s }} />
        ))}
        <span>بیشتر</span>
      </div>
    </section>
  );
}
