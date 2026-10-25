/**
 * تبدیل تقویم جلالی (شمسی) ↔ میلادی — بدون هیچ وابستگی خارجی.
 * الگوریتم استاندارد Borkowski، همون چیزی که کتابخونه‌های معروف هم استفاده می‌کنن.
 */

export type JalaliDate = { jy: number; jm: number; jd: number };
export type GregorianDate = { gy: number; gm: number; gd: number };

const breaks = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

type CalConfig = { leap: number; gy: number; march: number };

function jalCal(jy: number): CalConfig {
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];

  if (jy < jp || jy >= breaks[bl - 1]) throw new Error('سال شمسی خارج از محدوده: ' + jy);

  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function div(a: number, b: number) {
  return Math.trunc(a / b);
}
function mod(a: number, b: number) {
  return a - Math.trunc(a / b) * b;
}

/** آیا سال شمسی کبیسه است؟ */
export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

/** تعداد روزهای یک ماه شمسی */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** شماره روز ژولین از تاریخ میلادی */
export function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** تاریخ میلادی از شماره روز ژولین */
export function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd));
}

/* ---------- کار با رشته‌ی ISO (YYYY-MM-DD) که فرمت ذخیره‌سازی ماست ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

export function isoOf(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

export function parseIso(iso: string): GregorianDate {
  const [gy, gm, gd] = iso.split('-').map(Number);
  return { gy, gm, gd };
}

/** ISO میلادی → تاریخ شمسی */
export function isoToJalali(iso: string): JalaliDate {
  const { gy, gm, gd } = parseIso(iso);
  return toJalali(gy, gm, gd);
}

/** تاریخ شمسی → ISO میلادی */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  return isoOf(g.gy, g.gm, g.gd);
}

/** جمع/تفریق روز روی یک ISO */
export function addDays(iso: string, days: number): string {
  const { gy, gm, gd } = parseIso(iso);
  const g = d2g(g2d(gy, gm, gd) + days);
  return isoOf(g.gy, g.gm, g.gd);
}

export function diffDays(a: string, b: string): number {
  const ga = parseIso(a);
  const gb = parseIso(b);
  return g2d(ga.gy, ga.gm, ga.gd) - g2d(gb.gy, gb.gm, gb.gd);
}

/** ایندکس روز هفته با شروع از شنبه: 0=شنبه ... 6=جمعه */
export function weekdayIndex(iso: string): number {
  const { gy, gm, gd } = parseIso(iso);
  return (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
}

/** همه‌ی روزهای یک ماه شمسی به صورت ISO میلادی */
export function jalaliMonthDays(jy: number, jm: number): string[] {
  const len = jalaliMonthLength(jy, jm);
  const out: string[] = [];
  for (let d = 1; d <= len; d += 1) out.push(jalaliToIso(jy, jm, d));
  return out;
}

/** همه‌ی روزهای یک ماه میلادی */
export function gregorianMonthDays(gy: number, gm: number): string[] {
  const len = new Date(Date.UTC(gy, gm, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= len; d += 1) out.push(isoOf(gy, gm, d));
  return out;
}

/** امروز به وقت تهران، به صورت ISO میلادی */
export function todayIso(timeZone = 'Asia/Tehran'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}
