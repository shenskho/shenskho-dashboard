'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'ورود ناموفق بود');
        return;
      }
      const dest = params.get('from') || '/';
      router.replace(dest);
      router.refresh();
    } catch {
      setError('خطا در ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="text-center">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          ورود به داشبورد
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          رمز عبور رو وارد کن
        </p>
      </div>

      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="رمز عبور"
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
      />

      {error && (
        <p className="text-sm" style={{ color: 'var(--crit)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? 'در حال ورود…' : 'ورود'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
