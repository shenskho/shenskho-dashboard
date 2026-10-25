'use client';

import { useState } from 'react';

type Props = {
  onClose: () => void;
  onSubmit: (titles: string[]) => void | Promise<void>;
};

export default function QuickCapture({ onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const titles = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  async function submit() {
    if (titles.length === 0 || busy) return;
    setBusy(true);
    await onSubmit(titles);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card flex w-full max-w-lg flex-col gap-3 p-4"
        style={{ background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">ثبت سریع چند کار</h2>
          <button type="button" onClick={onClose} aria-label="بستن" style={{ color: 'var(--muted)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          هر خط یک کار می‌شود. می‌تونی مستقیم چند خط رو پیست کنی.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
          rows={6}
          placeholder={'مثلاً:\nایمیل به مشتری\nریویو پول ریکوئست\nتماس با بانک'}
          className="w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
          style={{ border: '1px solid var(--border)' }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {titles.length} کار شناسایی شد
          </span>
          <button
            type="button"
            disabled={titles.length === 0 || busy}
            onClick={submit}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {busy ? 'در حال ثبت…' : 'افزودن همه'}
          </button>
        </div>
      </div>
    </div>
  );
}
