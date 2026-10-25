'use client';

import { useCallback, useEffect, useState } from 'react';
import { fa } from '@/lib/date/format';
import type { ProjectWithStats } from '@/lib/types';
import { COLOR_KEYS, COLORS } from '@/lib/types';
import { useSettings } from '@/components/Providers';

export default function ProjectsPage() {
  const { theme } = useSettings();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [color, setColor] = useState<string>(COLOR_KEYS[0]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/projects', { cache: 'no-store' });
    setProjects(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setName('');
    setClient('');
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: value, client_name: client.trim() || null, color }),
    });
    load();
  }

  async function setStatus(id: string, status: 'active' | 'done' | 'archived') {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    setProjects((ps) => ps.filter((p) => p.id !== id));
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  }

  const visible = projects.filter((p) => (showArchived ? true : p.status !== 'archived'));

  return (
    <div className="flex flex-col gap-5 fade-in">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">پروژه‌ها و مشتری‌ها</h1>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="rounded-lg px-2.5 py-1.5 text-xs"
          style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          {showArchived ? 'مخفی کردن آرشیو' : 'نمایش آرشیو'}
        </button>
      </section>

      <form onSubmit={addProject} className="card flex flex-wrap items-center gap-2 p-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام پروژه…"
          className="min-w-[160px] flex-1 rounded-lg bg-transparent px-3 py-2 outline-none"
          style={{ border: '1px solid var(--border)' }}
        />
        <input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="نام مشتری (اختیاری)"
          className="min-w-[140px] flex-1 rounded-lg bg-transparent px-3 py-2 outline-none"
          style={{ border: '1px solid var(--border)' }}
        />
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="rounded-lg px-3 py-2 outline-none"
          style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          {COLOR_KEYS.map((c) => (
            <option key={c} value={c}>
              {COLORS[c].label}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
          افزودن
        </button>
      </form>

      {loading ? (
        <p className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          در حال بارگذاری…
        </p>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>هنوز پروژه‌ای ثبت نشده.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((p) => {
            const color = COLORS[p.color]?.[theme] ?? COLORS.slate[theme];
            const pct = p.totalTasks ? p.doneTasks / p.totalTasks : 0;
            return (
              <div key={p.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      {p.client_name && (
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {p.client_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="حذف"
                    onClick={() => remove(p.id)}
                    className="shrink-0"
                    style={{ color: 'var(--muted)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <span className="block h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: color }} />
                  </span>
                  <span className="tnum shrink-0 text-xs" style={{ color: 'var(--ink-2)' }}>
                    {fa(p.doneTasks)} از {fa(p.totalTasks)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['active', 'done', 'archived'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(p.id, s)}
                      className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
                      style={{
                        background: p.status === s ? 'var(--accent-soft)' : 'transparent',
                        color: p.status === s ? 'var(--ink)' : 'var(--muted)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {s === 'active' ? 'فعال' : s === 'done' ? 'تمام‌شده' : 'آرشیو'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
