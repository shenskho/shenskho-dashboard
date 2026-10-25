'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSettings } from './Providers';

const LINKS = [
  { href: '/', label: 'امروز' },
  { href: '/chart', label: 'چارت ماهانه' },
  { href: '/routines', label: 'روتین‌ها' },
  { href: '/projects', label: 'پروژه‌ها' },
  { href: '/weekly', label: 'مرور هفتگی' },
  { href: '/backup', label: 'بکاپ' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { calendar, setCalendar, theme, setTheme, ready } = useSettings();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  if (pathname === '/login') return null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-1.5 text-sm transition-colors"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-full p-1 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(['jalali', 'gregorian'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCalendar(m)}
              className="rounded-full px-3 py-1 transition-colors"
              style={{
                background: ready && calendar === m ? 'var(--surface-2)' : 'transparent',
                color: ready && calendar === m ? 'var(--ink)' : 'var(--muted)',
              }}
            >
              {m === 'jalali' ? 'شمسی' : 'میلادی'}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="تغییر تم"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          aria-label="خروج"
          title="خروج"
          onClick={logout}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>
    </header>
  );
}
