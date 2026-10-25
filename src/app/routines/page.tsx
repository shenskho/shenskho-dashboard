'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/components/Providers';
import { todayIso } from '@/lib/date/jalali';
import { WEEKDAYS, WEEKDAYS_SHORT } from '@/lib/date/format';
import type { Category, Routine } from '@/lib/types';
import { COLORS, COLOR_KEYS } from '@/lib/types';

export default function RoutinesPage() {
  const { theme } = useSettings();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [catId, setCatId] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [newCat, setNewCat] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      fetch('/api/routines', { cache: 'no-store' }).then((x) => x.json()),
      fetch('/api/categories', { cache: 'no-store' }).then((x) => x.json()),
    ]);
    setRoutines(r);
    setCategories(c);
    setCatId((prev) => prev || c[0]?.id || '');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addRoutine(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || days.length === 0) return;
    setTitle('');
    await fetch('/api/routines', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: value,
        category_id: catId || null,
        days: days.join(','),
        start_date: todayIso(),
      }),
    });
    load();
  }

  async function toggleActive(r: Routine) {
    await fetch(`/api/routines/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: r.active ? 0 : 1 }),
    });
    load();
  }

  async function remove(r: Routine) {
    await fetch(`/api/routines/${r.id}`, { method: 'DELETE' });
    load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    setNewCat('');
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, color: newCatColor }),
    });
    load();
  }

  async function removeCategory(id: string) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="flex flex-col gap-5 fade-in">
      <div>
        <h1 className="text-lg font-semibold">روتین‌ها</h1>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          کارهایی که به‌صورت تکراری انجام می‌دی. هر روز که واردشون بشی، خودکار توی لیست همون روز ساخته می‌شن.
        </p>
      </div>

      <form onSubmit={addRoutine} className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً: یک ساعت مطالعه‌ی تخصصی"
            className="min-w-[200px] flex-1 rounded-lg bg-transparent px-3 py-2 outline-none"
            style={{ border: '1px solid var(--border)' }}
          />
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="rounded-lg px-3 py-2 outline-none"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
            افزودن روتین
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-xs" style={{ color: 'var(--muted)' }}>روزهای هفته:</span>
          {WEEKDAYS.map((label, i) => {
            const on = days.includes(i);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((d) => (on ? d.filter((x) => x !== i) : [...d, i].sort()))}
                className="rounded-lg px-2.5 py-1 text-xs transition-colors"
                style={{
                  border: '1px solid var(--border)',
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </form>

      {routines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {routines.map((r) => {
            const cat = categories.find((c) => c.id === r.category_id);
            const color = COLORS[cat?.color ?? 'slate']?.[theme] ?? COLORS.slate[theme];
            const active = r.active === 1;
            return (
              <li key={r.id} className="card flex flex-wrap items-center gap-3 p-3" style={{ opacity: active ? 1 : 0.55 }}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="flex-1" style={{ color: 'var(--ink)' }}>{r.title}</span>
                <span className="flex gap-1">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <span
                      key={d}
                      className="flex h-5 w-5 items-center justify-center rounded text-[10px]"
                      style={{
                        background: r.days.split(',').includes(String(i)) ? 'var(--accent-soft)' : 'transparent',
                        color: r.days.split(',').includes(String(i)) ? 'var(--ink-2)' : 'var(--muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </span>
                <button type="button" onClick={() => toggleActive(r)} className="rounded-lg px-2.5 py-1 text-xs" style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                  {active ? 'غیرفعال کن' : 'فعال کن'}
                </button>
                <button type="button" onClick={() => remove(r)} aria-label="حذف روتین" style={{ color: 'var(--muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* دسته‌بندی‌ها */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">دسته‌بندی‌ها</h2>
        <ul className="mb-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-full px-3 py-1 text-xs" style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[c.color]?.[theme] ?? COLORS.slate[theme] }} />
              {c.name}
              <button type="button" onClick={() => removeCategory(c.id)} aria-label={`حذف ${c.name}`} style={{ color: 'var(--muted)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="دسته‌ی جدید"
            className="rounded-lg bg-transparent px-3 py-1.5 text-sm outline-none"
            style={{ border: '1px solid var(--border)' }}
          />
          <div className="flex gap-1">
            {COLOR_KEYS.filter((k) => k !== 'slate').map((k) => (
              <button
                key={k}
                type="button"
                aria-label={COLORS[k].label}
                onClick={() => setNewCatColor(k)}
                className="h-6 w-6 rounded-full"
                style={{
                  background: COLORS[k][theme],
                  outline: newCatColor === k ? '2px solid var(--ink)' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
            افزودن
          </button>
        </form>
      </section>
    </div>
  );
}
