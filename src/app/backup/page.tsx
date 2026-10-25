'use client';

import { useRef, useState } from 'react';

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setConfirming(true);
    setStatus(null);
  }

  async function doImport() {
    if (!pendingFile) return;
    setBusy(true);
    setConfirming(false);
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus({ type: 'error', text: err.error || 'خطا در بازیابی' });
      } else {
        setStatus({ type: 'ok', text: 'بازیابی با موفقیت انجام شد. صفحه را رفرش کن.' });
      }
    } catch {
      setStatus({ type: 'error', text: 'فایل نامعتبر است — باید همان فایل JSON خروجی این اپ باشد' });
    } finally {
      setBusy(false);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-5 fade-in">
      <h1 className="text-lg font-semibold">بکاپ و خروجی داده‌ها</h1>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">خروجی گرفتن</h2>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          یک نسخه از تمام داده‌هات (تسک‌ها، دسته‌ها، روتین‌ها، پروژه‌ها، تنظیمات) رو دانلود کن.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            دانلود JSON کامل
          </a>
          <a
            href="/api/export?format=csv"
            className="rounded-lg px-4 py-2 text-sm"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            دانلود CSV تسک‌ها
          </a>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5" style={{ borderColor: 'var(--crit)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--crit)' }}>
          بازیابی از فایل بکاپ
        </h2>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          هشدار: بازیابی، همه‌ی داده‌های فعلی اپ رو با محتوای فایل بکاپ جایگزین می‌کنه — این کار برگشت‌ناپذیره.
          فقط از فایل JSON که خودت از همین اپ خروجی گرفتی استفاده کن.
        </p>
        <input ref={fileRef} type="file" accept="application/json" onChange={onFileChosen} className="hidden" />
        <button
          type="button"
          onClick={pickFile}
          disabled={busy}
          className="w-fit rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ border: '1px solid var(--crit)', color: 'var(--crit)' }}
        >
          {busy ? 'در حال بازیابی…' : 'انتخاب فایل و بازیابی'}
        </button>

        {status && (
          <p className="text-xs" style={{ color: status.type === 'ok' ? 'var(--good)' : 'var(--crit)' }}>
            {status.text}
          </p>
        )}
      </section>

      {confirming && pendingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            setConfirming(false);
            setPendingFile(null);
            if (fileRef.current) fileRef.current.value = '';
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card flex w-full max-w-sm flex-col gap-3 p-5"
            style={{ background: 'var(--surface)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--crit)' }}>
              مطمئنی؟
            </h3>
            <p className="text-xs" style={{ color: 'var(--ink-2)' }}>
              با بازیابی فایل «{pendingFile.name}»، همه‌ی داده‌های فعلی اپ حذف و با این فایل جایگزین می‌شن. این کار
              قابل بازگشت نیست.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={doImport}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: 'var(--crit)', color: '#fff' }}
              >
                بله، جایگزین کن
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setPendingFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="flex-1 rounded-lg px-4 py-2 text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--ink-2)' }}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
