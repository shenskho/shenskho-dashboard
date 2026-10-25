'use client';

import { useCallback, useEffect, useState } from 'react';
import { fa, longDate } from '@/lib/date/format';
import { useSettings } from '@/components/Providers';
import type { AgentRun, AgentWithStats, MemoryFact, ReviewItem } from '@/lib/types';

const TABS = [
  { id: 'overview', label: 'نمای‌کلی' },
  { id: 'inbox', label: 'صندوق تأیید' },
  { id: 'memory', label: 'حافظه‌ی مشترک' },
  { id: 'runs', label: 'لاگ اجرا' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AssistantsPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    const res = await fetch('/api/agents', { cache: 'no-store' });
    const data: AgentWithStats[] = await res.json();
    setAgents(data);
    setPendingCount(data.reduce((s, a) => s + a.pendingCount, 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <div className="flex flex-col gap-5 fade-in">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">دستیارهای هوشمند</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            زیرساخت مشترک — هیچ خروجی‌ای بدون تأیید تو منتشر نمی‌شود.
          </p>
        </div>
      </section>

      <nav className="flex items-center gap-1 rounded-full p-1 w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative rounded-full px-4 py-1.5 text-sm transition-colors"
            style={{
              background: tab === t.id ? 'var(--accent-soft)' : 'transparent',
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
            {t.id === 'inbox' && pendingCount > 0 && (
              <span
                className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px]"
                style={{ background: 'var(--crit)', color: '#fff' }}
              >
                {fa(pendingCount)}
              </span>
            )}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>
      ) : tab === 'overview' ? (
        <OverviewTab agents={agents} onChanged={loadAgents} />
      ) : tab === 'inbox' ? (
        <InboxTab onDecided={loadAgents} />
      ) : tab === 'memory' ? (
        <MemoryTab />
      ) : (
        <RunsTab />
      )}
    </div>
  );
}

/* ------------------------------- نمای‌کلی ------------------------------- */

const STATUS_LABEL: Record<string, string> = { planned: 'برنامه‌ریزی‌شده', active: 'فعال', paused: 'متوقف' };
const STATUS_COLOR: Record<string, string> = { planned: 'var(--muted)', active: 'var(--good)', paused: 'var(--warn)' };

/** فقط این دستیارها منطق واقعی دارن و می‌شه دستی اجراشون کرد — بقیه هنوز رکورد برنامه‌ریزی‌شده‌ان (فاز ۴) */
const IMPLEMENTED_AGENT_SLUGS = ['linkedin-content'];

function OverviewTab({ agents, onChanged }: { agents: AgentWithStats[]; onChanged: () => void }) {
  const { calendar } = useSettings();
  const [running, setRunning] = useState<string | null>(null);
  const [runError, setRunError] = useState<{ id: string; message: string } | null>(null);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/agents/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    onChanged();
  }

  async function runNow(slug: string, id: string) {
    setRunning(id);
    setRunError(null);
    try {
      const res = await fetch(`/api/agents/${slug}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'اجرا ناموفق بود');
      if (data.status === 'error') throw new Error(data.error || 'اجرا با خطا تمام شد');
    } catch (e) {
      setRunError({ id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(null);
      onChanged();
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {agents.map((a) => (
        <div key={a.id} className="card flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {a.description}
              </p>
            </div>
            {a.pendingCount > 0 && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px]"
                style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }}
              >
                {fa(a.pendingCount)} در صف تأیید
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {(['planned', 'active', 'paused'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(a.id, s)}
                className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
                style={{
                  background: a.status === s ? 'var(--accent-soft)' : 'transparent',
                  color: a.status === s ? STATUS_COLOR[s] : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            {a.schedule_note && <span>زمان‌بندی: {a.schedule_note}</span>}
            <span>
              آخرین اجرا:{' '}
              {a.lastRun ? longDate(a.lastRun.started_at.slice(0, 10), calendar) : 'هنوز اجرا نشده'}
            </span>
          </div>

          {IMPLEMENTED_AGENT_SLUGS.includes(a.slug) ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={running === a.id}
                onClick={() => runNow(a.slug, a.id)}
                className="w-fit rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {running === a.id ? 'در حال اجرا…' : 'اجرای دستی'}
              </button>
              {runError?.id === a.id && (
                <p className="text-[11px]" style={{ color: 'var(--crit)' }}>
                  {runError.message}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              منطق واقعی این دستیار هنوز ساخته نشده (فاز ۴).
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ صندوق تأیید ------------------------------ */

function InboxTab({ onDecided }: { onDecided: () => void }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    const res = await fetch(`/api/review-queue${status ? `?status=${status}` : ''}`, { cache: 'no-store' });
    setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(showHistory ? undefined : 'pending');
  }, [showHistory, load]);

  async function decide(id: string, decision: 'approved' | 'rejected') {
    await fetch(`/api/review-queue/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    load(showHistory ? undefined : 'pending');
    onDecided();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="rounded-lg px-2.5 py-1 text-xs"
          style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          {showHistory ? 'فقط در انتظار' : 'نمایش تاریخچه'}
        </button>
      </div>

      {loading ? (
        <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>چیزی در صف تأیید نیست.</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            وقتی دستیارها فعال بشن، پیشنهادهاشون (حقیقت یا پیش‌نویس خروجی) اینجا میاد تا تأیید کنی.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => {
            let detail = '';
            try {
              const p = JSON.parse(it.payload);
              detail = it.kind === 'fact' ? `${p.key}: ${p.value}` : p.content;
            } catch {
              detail = it.payload;
            }
            return (
              <li key={it.id} className="card flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{it.title}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {it.agent_name} · {it.kind === 'fact' ? 'پیشنهاد حقیقت' : 'پیش‌نویس خروجی'}
                    </p>
                  </div>
                  {it.status !== 'pending' && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: it.status === 'approved' ? 'rgba(12,163,12,0.12)' : 'rgba(208,59,59,0.12)',
                        color: it.status === 'approved' ? 'var(--good)' : 'var(--crit)',
                      }}
                    >
                      {it.status === 'approved' ? 'تأییدشده' : 'ردشده'}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap rounded-lg p-3 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                  {detail}
                </p>
                {it.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(it.id, 'approved')}
                      className="rounded-lg px-4 py-1.5 text-sm font-medium"
                      style={{ background: 'var(--good)', color: '#fff' }}
                    >
                      تأیید
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(it.id, 'rejected')}
                      className="rounded-lg px-4 py-1.5 text-sm"
                      style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
                    >
                      رد
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- حافظه‌ی مشترک ----------------------------- */

const FACT_STATUS_LABEL: Record<string, string> = {
  approved: 'تأییدشده',
  proposed: 'در انتظار تأیید',
  rejected: 'ردشده',
  superseded: 'جایگزین‌شده',
};

function MemoryTab() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [filter, setFilter] = useState<string>('approved');
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const load = useCallback(async (status: string) => {
    setLoading(true);
    const res = await fetch(`/api/memory-facts${status ? `?status=${status}` : ''}`, { cache: 'no-store' });
    setFacts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function addFact(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;
    await fetch('/api/memory-facts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), value: value.trim() }),
    });
    setKey('');
    setValue('');
    load(filter);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={addFact} className="card flex flex-wrap items-center gap-2 p-3">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="کلید (مثلاً job-target)"
          className="w-48 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
          style={{ border: '1px solid var(--border)' }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="مقدار"
          className="min-w-[200px] flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
          style={{ border: '1px solid var(--border)' }}
        />
        <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
          ثبت مستقیم
        </button>
      </form>

      <div className="flex items-center gap-1.5">
        {(['approved', 'proposed', 'rejected', 'superseded'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
            style={{
              background: filter === s ? 'var(--accent-soft)' : 'transparent',
              color: filter === s ? 'var(--ink)' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            {FACT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>
      ) : facts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>چیزی در این فیلتر نیست.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {facts.map((f) => (
            <li key={f.id} className="card flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm">
                  <span style={{ color: 'var(--muted)' }}>{f.key}:</span> {f.value}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  منبع: {f.source === 'user' ? 'کاربر' : f.agent_name ?? 'دستیار'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- لاگ اجرا -------------------------------- */

const RUN_STATUS_LABEL: Record<string, string> = { running: 'در حال اجرا', success: 'موفق', error: 'خطا' };
const RUN_STATUS_COLOR: Record<string, string> = { running: 'var(--accent)', success: 'var(--good)', error: 'var(--crit)' };

function RunsTab() {
  const { calendar } = useSettings();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agent-runs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setRuns(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="card p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>در حال بارگذاری…</p>;
  }

  if (runs.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>هنوز هیچ دستیاری اجرا نشده.</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          این تب لاگ هر اجرای یک دستیار (موفق/خطا، خلاصه، تعداد توکن و هزینه‌ی تخمینی) رو نشون می‌ده —
          تا وقتی دستیارهای واقعی ساخته نشدن (فاز ۴)، خالیه.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.map((r) => (
        <li key={r.id} className="card flex flex-col gap-1.5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{r.agent_name}</p>
            <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: RUN_STATUS_COLOR[r.status] }}>
              {RUN_STATUS_LABEL[r.status]}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{longDate(r.started_at.slice(0, 10), calendar)}</p>
          {r.summary && <p className="text-xs" style={{ color: 'var(--ink-2)' }}>{r.summary}</p>}
          {r.error && <p className="text-xs" style={{ color: 'var(--crit)' }}>{r.error}</p>}
        </li>
      ))}
    </ul>
  );
}
