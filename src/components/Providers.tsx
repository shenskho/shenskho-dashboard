'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CalendarMode } from '@/lib/date/format';

type Theme = 'light' | 'dark';

type Ctx = {
  calendar: CalendarMode;
  setCalendar: (m: CalendarMode) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  ready: boolean;
};

const SettingsCtx = createContext<Ctx>({
  calendar: 'jalali',
  setCalendar: () => {},
  theme: 'dark',
  setTheme: () => {},
  ready: false,
});

export function useSettings() {
  return useContext(SettingsCtx);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [calendar, setCalendarState] = useState<CalendarMode>('jalali');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem('calendar');
      if (c === 'gregorian' || c === 'jalali') setCalendarState(c);
      const t = localStorage.getItem('theme');
      if (t === 'light' || t === 'dark') setThemeState(t);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setCalendar = useCallback((m: CalendarMode) => {
    setCalendarState(m);
    try {
      localStorage.setItem('calendar', m);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ calendar, setCalendar, theme, setTheme, ready }),
    [calendar, setCalendar, theme, setTheme, ready],
  );

  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}
