import { isoToJalali, parseIso, weekdayIndex } from './jalali';

export type CalendarMode = 'jalali' | 'gregorian';

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const GREGORIAN_MONTHS = [
  'ژانویه',
  'فوریه',
  'مارس',
  'آوریل',
  'مه',
  'ژوئن',
  'ژوئیه',
  'اوت',
  'سپتامبر',
  'اکتبر',
  'نوامبر',
  'دسامبر',
];

/** روزهای هفته با شروع از شنبه */
export const WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** تبدیل اعداد لاتین به فارسی (به همراه ممیز فارسی) */
export function fa(value: string | number): string {
  return String(value)
    .replace(/\d/g, (d) => FA_DIGITS[Number(d)])
    .replace(/\.(?=[۰-۹])/g, '٫');
}

export function monthTitle(mode: CalendarMode, y: number, m: number): string {
  const name = mode === 'jalali' ? JALALI_MONTHS[m - 1] : GREGORIAN_MONTHS[m - 1];
  return `${name} ${fa(y)}`;
}

/** «۲۰ شهریور» یا «۱۱ سپتامبر» */
export function shortDate(iso: string, mode: CalendarMode): string {
  if (mode === 'jalali') {
    const j = isoToJalali(iso);
    return `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
  }
  const g = parseIso(iso);
  return `${fa(g.gd)} ${GREGORIAN_MONTHS[g.gm - 1]}`;
}

/** «شنبه ۲۰ شهریور ۱۴۰۵» */
export function longDate(iso: string, mode: CalendarMode): string {
  const wd = WEEKDAYS[weekdayIndex(iso)];
  if (mode === 'jalali') {
    const j = isoToJalali(iso);
    return `${wd} ${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${fa(j.jy)}`;
  }
  const g = parseIso(iso);
  return `${wd} ${fa(g.gd)} ${GREGORIAN_MONTHS[g.gm - 1]} ${fa(g.gy)}`;
}

/** فقط شماره‌ی روز در ماه جاری تقویم انتخابی */
export function dayOfMonth(iso: string, mode: CalendarMode): number {
  return mode === 'jalali' ? isoToJalali(iso).jd : parseIso(iso).gd;
}
