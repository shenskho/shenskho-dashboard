import { NextResponse } from 'next/server';
import { AUTH_COOKIE, checkPassword, expectedToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  const ok = await checkPassword(password);
  if (!ok) {
    return NextResponse.json({ error: 'رمز عبور اشتباه است' }, { status: 401 });
  }

  const token = await expectedToken();
  const res = NextResponse.json({ ok: true });
  if (token) {
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // ۳۰ روز
    });
  }
  return res;
}
