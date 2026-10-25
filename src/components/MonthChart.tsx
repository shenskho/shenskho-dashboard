'use client';

import { useEffect, useRef, useState } from 'react';
import type { MonthPoint } from '@/lib/types';
import { fa, shortDate, type CalendarMode } from '@/lib/date/format';

type Props = {
  points: MonthPoint[];
  calendar: CalendarMode;
  average: number;
  title: string;
  subtitle?: string;
  target?: number | null;
};

const H = 300;
const PAD = { top: 18, right: 36, bottom: 30, left: 36 };

export default function MonthChart({ points, calendar, average, title, subtitle, target }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const plotW = w - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(1, target || 0, ...points.map((p) => p.done));
  const yMax = niceMax(maxVal);
  const ticks = tickValues(yMax);

  // روز اول سمت راست (چون رابط راست‌چین است)
  const xFor = (i: number) => w - PAD.right - (n > 1 ? (i / (n - 1)) * plotW : 0);
  const yFor = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const past = points.filter((p) => !p.isFuture);
  const line = past.map((p) => `${xFor(p.index - 1)},${yFor(p.done)}`).join(' ');
  const area =
    past.length > 1
      ? `M ${xFor(past[0].index - 1)},${PAD.top + plotH} L ${past
          .map((p) => `${xFor(p.index - 1)},${yFor(p.done)}`)
          .join(' L ')} L ${xFor(past[past.length - 1].index - 1)},${PAD.top + plotH} Z`
      : '';

  const labelEvery = n > 20 ? 5 : 3;
  const hoverPoint = hover !== null ? points[hover] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (w - PAD.right - x) / plotW;
    const i = Math.round(ratio * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-lg px-2.5 py-1 text-xs"
          style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          {showTable ? 'نمایش نمودار' : 'نمایش جدول'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-right text-xs tnum">
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th className="py-1 font-normal">روز</th>
                <th className="py-1 font-normal">انجام‌شده</th>
                <th className="py-1 font-normal">کل</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day} style={{ borderTop: '1px solid var(--border)', color: p.isFuture ? 'var(--muted)' : 'var(--ink-2)' }}>
                  <td className="py-1">{shortDate(p.day, calendar)}</td>
                  <td className="py-1">{p.isFuture ? '—' : fa(p.done)}</td>
                  <td className="py-1">{p.isFuture ? '—' : fa(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative w-full">
          <svg
            width={w}
            height={H}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'block', touchAction: 'none', direction: 'ltr' }}
            role="img"
            aria-label={title}
          >
            {/* خطوط راهنمای افقی */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--grid)" strokeWidth="1" />
                <text x={w - PAD.right + 8} y={yFor(t) + 4} fontSize="10" fill="var(--muted)" className="tnum">
                  {fa(t)}
                </text>
              </g>
            ))}

            {/* خط میانگین */}
            {average > 0 && (
              <g>
                <line
                  x1={PAD.left}
                  x2={w - PAD.right}
                  y1={yFor(average)}
                  y2={yFor(average)}
                  stroke="var(--axis)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text x={PAD.left} y={yFor(average) - 6} fontSize="10" fill="var(--muted)" textAnchor="start">
                  {`میانگین ${fa(average.toFixed(1))}`}
                </text>
              </g>
            )}

            {/* خط هدف */}
            {!!target && target > 0 && (
              <g>
                <line
                  x1={PAD.left}
                  x2={w - PAD.right}
                  y1={yFor(target)}
                  y2={yFor(target)}
                  stroke="var(--good)"
                  strokeWidth="1.5"
                  strokeDasharray="2 4"
                />
                <text x={PAD.left} y={yFor(target) - 6} fontSize="10" fill="var(--good)" textAnchor="start">
                  {`هدف روزانه ${fa(target)}`}
                </text>
              </g>
            )}

            {/* خط پایه */}
            <line x1={PAD.left} x2={w - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="var(--axis)" strokeWidth="1" />

            {/* ناحیه‌ی زیر نمودار */}
            {area && <path d={area} fill="var(--accent)" opacity="0.1" />}

            {/* خط نمودار */}
            {past.length > 1 && (
              <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* نقطه‌ها */}
            {past.map((p) => (
              <circle
                key={p.day}
                cx={xFor(p.index - 1)}
                cy={yFor(p.done)}
                r={hover === p.index - 1 ? 5.5 : 4}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}

            {/* برچسب روزها */}
            {points.map((p) =>
              p.index === 1 || p.index % labelEvery === 0 ? (
                <text key={p.day} x={xFor(p.index - 1)} y={H - 10} fontSize="10" fill="var(--muted)" textAnchor="middle" className="tnum">
                  {fa(p.index)}
                </text>
              ) : null,
            )}

            {/* خط‌چین هاور */}
            {hoverPoint && !hoverPoint.isFuture && (
              <line
                x1={xFor(hoverPoint.index - 1)}
                x2={xFor(hoverPoint.index - 1)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--axis)"
                strokeWidth="1"
              />
            )}
          </svg>

          {hoverPoint && !hoverPoint.isFuture && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                top: Math.max(4, yFor(hoverPoint.done) - 62),
                left: Math.min(Math.max(xFor(hoverPoint.index - 1) - 60, 4), w - 130),
                minWidth: 120,
              }}
            >
              <p style={{ color: 'var(--ink)' }}>{shortDate(hoverPoint.day, calendar)}</p>
              <p className="tnum" style={{ color: 'var(--ink-2)' }}>
                {fa(hoverPoint.done)} تسک انجام‌شده از {fa(hoverPoint.total)}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  return Math.ceil(v / 5) * 5;
}

function tickValues(max: number): number[] {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}
