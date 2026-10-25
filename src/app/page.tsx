'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TaskRow from '@/components/TaskRow';
import { useSettings } from '@/components/Providers';
import { addDays, todayIso } from '@/lib/date/jalali';
import { fa, longDate } from '@/lib/date/format';
import type { Category, DayPayload, ProjectWithStats, Task } from '@/lib/types';
import { COLORS } from '@/lib/types';
import QuickCapture from '@/components/QuickCapture';

export default function TodayPage() {
  const { calendar, theme } = useSettings();
  const [day, setDay] = useState<string>('');
  const [data, setData] = useState<DayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [catId, setCatId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [important, setImportant] = useState(false);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    setDay(todayIso());
    fetch('/api/projects', { cache: 'no-store' })
      .then((r) => r.json())
      .then((ps: ProjectWithStats[]) => setProjects(ps.filter((p) => p.status === 'active')))
      .catch(() => {});
  }, []);

  // میانبر صفحه‌کلید برای ثبت سریع: Ctrl/Cmd + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/day?day=${d}`, { cache: 'no-store' });
    const payload: DayPayload = await res.json();
    setData(payload);
    setLoading(false);
    setCatId((prev) => prev || payload.categories[0]?.id || '');
  }, []);

  useEffect(() => {
    if (day) load(day);
  }, [day, load]);

  const tasks = data?.tasks ?? [];
  const categories: Category[] = data?.categories ?? [];
  const doneCount = tasks.filter((t) => t.done === 1).length;
  const pct = tasks.length ? doneCount / tasks.length : 0;
  const isToday = day === todayIso();

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || !day) return;
    setTitle('');
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: value,
        day,
        category_id: catId || null,
        project_id: projectId || null,
        priority: important ? 2 : 1,
      }),
    });
    setImportant(false);
    load(day);
  }

  async function quickAdd(titles: string[]) {
    if (!day || titles.length === 0) return;
    await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ day, titles, category_id: catId || null, project_id: projectId || null }),
    });
    load(day);
  }

  async function toggle(task: Task) {
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done: t.done ? 0 : 1 } : t)) } : d,
    );
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ done: task.done ? 0 : 1 }),
    });
    load(day);
  }

  async function remove(task: Task) {
    setData((d) => (d ? { ...d, tasks: d.tasks.filter((t) => t.id !== task.id) } : d));
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
  }

  async function edit(task: Task, patch: Partial<Task>) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    load(day);
  }

  const grouped = useMemo(() => {
    const open = tasks.filter((t) => t.done === 0);
    const closed = tasks.filter((t) => t.done === 1);
    open.sort((a, b) => b.priority - a.priority || a.sort_order - b.sort_order);
    return { open, closed };
  }, [tasks]);

  if (!day) return null;

  return (
    <div className="flex flex-col gap-5 fade-in">
      {/* سربرگ روز */}
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="روز قبل"
            onClick={() => setDay(addDays(day, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{longDate(day, calendar)}</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {isToday ? 'امروز' : (
                <button type="button" onClick={() => setDay(todayIso())} style={{ color: 'var(--accent)' }}>
                  برگرد به امروز
                </button>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="روز بعد"
            onClick={() => setDay(addDays(day, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        </div>

        <ProgressRing done={doneCount} total={tasks.length} pct={pct} />
      </section>

      {/* افزودن تسک */}
      <form onSubmit={addTask} className="card flex flex-wrap items-center gap-2 p-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="یه کار جدید بنویس و Enter بزن…"
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
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg px-3 py-2 outline-none"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <option value="">بدون پروژه</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setImportant((v) => !v)}
          className="rounded-lg px-3 py-2 text-sm transition-colors"
          style={{
            border: '1px solid var(--border)',
            background: important ? 'var(--accent-soft)' : 'transparent',
            color: important ? 'var(--ink)' : 'var(--muted)',
          }}
        >
          مهم
        </button>
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          title="ثبت سریع چند کار (Ctrl/Cmd+K)"
          className="rounded-lg px-3 py-2 text-sm"
          style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          ثبت سریع
        </button>
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          افزودن
        </button>
      </form>

      {quickOpen && (
        <QuickCapture
          onClose={() => setQuickOpen(false)}
          onSubmit={async (titles) => {
            await quickAdd(titles);
            setQuickOpen(false);
          }}
        />
      )}

      {/* لیست تسک‌ها */}
      {loading ? (
        <p className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          در حال بارگذاری…
        </p>
      ) : tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>برای این روز هنوز کاری ثبت نشده.</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            کارهای همیشگی‌ات را در بخش «روتین‌ها» تعریف کن تا هر روز خودکار اینجا بیایند.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.open.length > 0 && (
            <ul className="flex flex-col gap-2">
              {grouped.open.map((t) => (
                <TaskRow key={t.id} task={t} categories={categories} projects={projects} onToggle={toggle} onDelete={remove} onEdit={edit} />
              ))}
            </ul>
          )}
          {grouped.closed.length > 0 && (
            <>
              <p className="px-1 text-xs" style={{ color: 'var(--muted)' }}>
                انجام‌شده ({fa(grouped.closed.length)})
              </p>
              <ul className="flex flex-col gap-2">
                {grouped.closed.map((t) => (
                  <TaskRow key={t.id} task={t} categories={categories} projects={projects} onToggle={toggle} onDelete={remove} onEdit={edit} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* تفکیک دسته‌ها در همین روز */}
      {tasks.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const total = tasks.filter((t) => t.category_id === c.id).length;
            if (!total) return null;
            const d = tasks.filter((t) => t.category_id === c.id && t.done === 1).length;
            return (
              <span
                key={c.id}
                className="flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[c.color]?.[theme] ?? COLORS.slate[theme] }} />
                {c.name}
                <span style={{ color: 'var(--muted)' }}>
                  {fa(d)} از {fa(total)}
                </span>
              </span>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ProgressRing({ done, total, pct }: { done: number; total: number; pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>انجام‌شده‌ی امروز</p>
        <p className="text-3xl font-semibold leading-tight">
          {fa(done)}
          <span className="text-base font-normal" style={{ color: 'var(--muted)' }}> از {fa(total)}</span>
        </p>
      </div>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--grid)" strokeWidth="5" />
        {pct > 0 && (
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dasharray .35s ease' }}
          />
        )}
      </svg>
    </div>
  );
}
