/**
 * داده‌ی نمونه برای اینکه نمودار و آمار را با داده‌ی واقعی‌نما ببینی.
 * اجرا:  node scripts/seed-demo.mjs            (سرور باید بالا باشد)
 *        node scripts/seed-demo.mjs http://localhost:3000
 * برای پاک کردن همه چیز کافی است فایل data/shenskho.db را حذف کنی.
 */

const BASE = process.argv[2] || 'http://localhost:3000';
const DAYS = Number(process.env.SEED_DAYS || 75);

const TITLES = [
  ['ادامه‌ی پروژه‌ی مشتری', 0],
  ['رفع باگ‌های گزارش‌شده', 0],
  ['ریویو کد و ریفکتور', 0],
  ['یک ساعت مطالعه‌ی تخصصی', 1],
  ['تمرین الگوریتم', 1],
  ['نوشتن پست لینکدین', 2],
  ['به‌روزرسانی پورتفولیو', 2],
  ['ورزش', 3],
  ['پیاده‌روی', 3],
  ['مرتب‌کردن کارهای عقب‌افتاده', 4],
];

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.TZ || 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const iso = (d) => fmt.format(d);

const res = await fetch(`${BASE}/api/categories`);
const categories = await res.json();

const today = new Date();
let created = 0;

for (let back = DAYS; back >= 0; back -= 1) {
  const d = new Date(today);
  d.setDate(d.getDate() - back);
  const day = iso(d);
  const weekend = d.getDay() === 5; // جمعه

  const count = weekend ? rand(0, 3) : rand(2, 7);
  const picks = shuffle([...TITLES]).slice(0, count);

  for (const [title, catIndex] of picks) {
    const body = {
      title,
      day,
      category_id: categories[catIndex]?.id ?? null,
      priority: Math.random() < 0.2 ? 2 : 1,
    };
    const r = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const task = await r.json();
    created += 1;
    // بیشتر کارها انجام شده‌اند، ولی نه همه — تا نمودار واقعی به نظر برسد
    if (Math.random() < (weekend ? 0.55 : 0.78)) {
      await fetch(`${BASE}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ done: 1 }),
      });
    }
  }
}

console.log(`✓ ${created} تسک نمونه در ${DAYS + 1} روز گذشته ساخته شد.`);

function rand(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
