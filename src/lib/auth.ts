/**
 * قفل ورود ساده — یک رمز عبور مشترک (نه چند کاربر، نه حساب کاربری).
 * اگر متغیر APP_PASSWORD ست نشده باشه، قفل غیرفعاله (برای توسعه‌ی لوکال راحت‌تره).
 * توکن کوکی = SHA-256(رمز) — با Web Crypto که در Edge Runtime هم کار می‌کنه.
 */

export const AUTH_COOKIE = 'shenskho_auth';

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD?.trim();
  if (!pw) return null;
  return sha256Hex(pw);
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD?.trim();
  if (!pw) return true;
  return input === pw;
}
