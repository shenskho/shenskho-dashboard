import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, expectedToken } from '@/lib/auth';

export const config = {
  matcher: [
    /*
     * همه‌ی مسیرها به جز:
     * - /login (خود صفحه‌ی ورود)
     * - /api/auth/* (ورود و خروج)
     * - فایل‌های استاتیک نکست و مانیفست/آیکون‌های PWA
     */
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|icons|sw.js).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  // اگر رمز ست نشده باشه، قفل کلاً غیرفعاله (راحت برای توسعه‌ی لوکال)
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await expectedToken();
  if (cookie && expected && cookie === expected) {
    return NextResponse.next();
  }

  // برای درخواست‌های API بدون کوکی معتبر، ۴۰۱ برگردون نه ریدایرکت
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'نیاز به ورود' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
