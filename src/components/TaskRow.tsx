'use client';

import { useState } from 'react';
import type { Category, ProjectWithStats, Task } from '@/lib/types';
import { COLORS } from '@/lib/types';
import { useSettings } from './Providers';

type Props = {
  task: Task;
  categories: Category[];
  projects?: ProjectWithStats[];
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task, patch: Partial<Task>) => void;
};

export default function TaskRow({ task, categories, projects, onToggle, onDelete, onEdit }: Props) {
  const { theme } = useSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const cat = categories.find((c) => c.id === task.category_id);
  const color = COLORS[cat?.color ?? 'slate']?.[theme] ?? COLORS.slate[theme];
  const done = task.done === 1;
  const project = projects?.find((p) => p.id === task.project_id);

  function commit() {
    const value = draft.trim();
    setEditing(false);
    if (value && value !== task.title) onEdit(task, { title: value });
    else setDraft(task.title);
  }

  return (
    <li
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{ background: done ? 'transparent' : 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        aria-label={done ? 'برگرداندن به انجام‌نشده' : 'انجام شد'}
        onClick={() => onToggle(task)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all"
        style={{
          border: `1.5px solid ${done ? color : 'var(--border-strong)'}`,
          background: done ? color : 'transparent',
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5.5 5.5L20 7" />
          </svg>
        )}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="flex-1 rounded-md bg-transparent px-1 py-0.5 outline-none"
          style={{ border: '1px solid var(--border-strong)' }}
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => setEditing(true)}
          onClick={() => onToggle(task)}
          className="flex-1 text-right"
          style={{
            color: done ? 'var(--muted)' : 'var(--ink)',
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'var(--muted)',
          }}
        >
          {task.title}
        </button>
      )}

      {task.priority === 2 && !done && (
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--accent-soft)', color: 'var(--ink-2)' }}>
          مهم
        </span>
      )}

      {project && (
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
        >
          {project.name}
        </span>
      )}

      {task.routine_id && (
        <span title="از روتین ساخته شده" className="shrink-0" style={{ color: 'var(--muted)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 01-4 4H3" />
          </svg>
        </span>
      )}

      <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} /> {cat?.name ?? 'بدون دسته'}
      </span>

      <button
        type="button"
        aria-label="حذف"
        onClick={() => onDelete(task)}
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        style={{ color: 'var(--muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}
