import { getDb, newId, nowIso } from './db';
import type {
  Category,
  DayMeta,
  DayPayload,
  MonthPoint,
  MonthStats,
  Project,
  ProjectWithStats,
  Routine,
  Targets,
  Task,
  WeekSummary,
} from './types';
import { addDays, diffDays, weekdayIndex } from './date/jalali';

/* ------------------------------- دسته‌بندی‌ها ------------------------------ */

const DEFAULT_CATEGORIES: [string, string][] = [
  ['کار و پروژه', 'blue'],
  ['یادگیری', 'orange'],
  ['برندسازی و لینکدین', 'aqua'],
  ['ورزش و سلامت', 'yellow'],
  ['شخصی', 'magenta'],
];

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  let rows = await db.all<Category>('SELECT * FROM categories ORDER BY created_at ASC');
  if (rows.length === 0) {
    for (const [name, color] of DEFAULT_CATEGORIES) {
      await db.run('INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)', [
        newId(),
        name,
        color,
        nowIso(),
      ]);
    }
    rows = await db.all<Category>('SELECT * FROM categories ORDER BY created_at ASC');
  }
  return rows;
}

export async function createCategory(name: string, color: string): Promise<Category> {
  const db = await getDb();
  const row: Category = { id: newId(), name, color, created_at: nowIso() };
  await db.run('INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)', [
    row.id,
    row.name,
    row.color,
    row.created_at,
  ]);
  return row;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE tasks SET category_id = NULL WHERE category_id = ?', [id]);
  await db.run('UPDATE routines SET category_id = NULL WHERE category_id = ?', [id]);
  await db.run('DELETE FROM categories WHERE id = ?', [id]);
}

/* --------------------------------- روتین‌ها -------------------------------- */

export async function listRoutines(): Promise<Routine[]> {
  const db = await getDb();
  return db.all<Routine>('SELECT * FROM routines ORDER BY created_at ASC');
}

export async function createRoutine(input: {
  title: string;
  category_id?: string | null;
  days?: string;
  priority?: number;
  start_date: string;
}): Promise<Routine> {
  const db = await getDb();
  const row: Routine = {
    id: newId(),
    title: input.title,
    category_id: input.category_id ?? null,
    days: input.days ?? '0,1,2,3,4,5,6',
    priority: input.priority ?? 1,
    active: 1,
    start_date: input.start_date,
    created_at: nowIso(),
  };
  await db.run(
    `INSERT INTO routines (id, title, category_id, days, priority, active, start_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.title, row.category_id, row.days, row.priority, row.active, row.start_date, row.created_at],
  );
  return row;
}

export async function updateRoutine(id: string, patch: Partial<Routine>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['title', 'category_id', 'days', 'priority', 'active'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return;
  values.push(id);
  await db.run(`UPDATE routines SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteRoutine(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM routines WHERE id = ?', [id]);
  await db.run('DELETE FROM routine_days WHERE routine_id = ?', [id]);
  await db.run('DELETE FROM tasks WHERE routine_id = ? AND done = 0', [id]);
}

/**
 * تسک‌های یک روز را از روی روتین‌های فعال می‌سازد.
 * برای هر (روز، روتین) فقط یک بار اجرا می‌شود، پس اگر تسکی را پاک کنی دوباره برنمی‌گردد.
 */
export async function materializeRoutines(day: string): Promise<void> {
  const db = await getDb();
  const wd = weekdayIndex(day);
  const routines = await db.all<Routine>('SELECT * FROM routines WHERE active = 1');
  if (!routines.length) return;

  const seen = await db.all<{ routine_id: string }>(
    'SELECT routine_id FROM routine_days WHERE day = ?',
    [day],
  );
  const done = new Set(seen.map((r) => r.routine_id));

  let order = 0;
  for (const r of routines) {
    if (done.has(r.id)) continue;
    if (day < r.start_date) continue;
    const days = r.days.split(',').map((s) => Number(s.trim()));
    if (!days.includes(wd)) continue;

    const ts = nowIso();
    await db.run(
      `INSERT INTO tasks (id, title, notes, category_id, day, done, done_at, priority, routine_id, sort_order, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, 0, NULL, ?, ?, ?, ?, ?)`,
      [newId(), r.title, r.category_id, day, r.priority, r.id, (order -= 1), ts, ts],
    );
    await db.run('INSERT INTO routine_days (day, routine_id) VALUES (?, ?)', [day, r.id]);
  }
}

/* ---------------------------------- تسک‌ها --------------------------------- */

export async function getDay(day: string): Promise<DayPayload> {
  await materializeRoutines(day);
  const db = await getDb();
  const [tasks, categories, meta] = await Promise.all([
    db.all<Task>('SELECT * FROM tasks WHERE day = ? ORDER BY sort_order ASC, created_at ASC', [day]),
    listCategories(),
    db.all<DayMeta>('SELECT * FROM day_meta WHERE day = ?', [day]),
  ]);
  return { day, tasks, categories, meta: meta[0] ?? null };
}

export async function createTask(input: {
  title: string;
  day: string;
  category_id?: string | null;
  project_id?: string | null;
  priority?: number;
  notes?: string | null;
}): Promise<Task> {
  const db = await getDb();
  const ts = nowIso();
  const row: Task = {
    id: newId(),
    title: input.title,
    notes: input.notes ?? null,
    category_id: input.category_id ?? null,
    project_id: input.project_id ?? null,
    day: input.day,
    done: 0,
    done_at: null,
    priority: input.priority ?? 1,
    routine_id: null,
    sort_order: 0,
    created_at: ts,
    updated_at: ts,
  };
  await db.run(
    `INSERT INTO tasks (id, title, notes, category_id, project_id, day, done, done_at, priority, routine_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL, 0, ?, ?)`,
    [row.id, row.title, row.notes, row.category_id, row.project_id, row.day, row.priority, ts, ts],
  );
  return row;
}

/** افزودن چندتایی — هر خط یک تسک؛ برای «ثبت سریع» */
export async function createTasksBulk(
  titles: string[],
  common: { day: string; category_id?: string | null; project_id?: string | null; priority?: number },
): Promise<Task[]> {
  const out: Task[] = [];
  for (const title of titles) {
    const t = title.trim();
    if (!t) continue;
    out.push(await createTask({ title: t, ...common }));
  }
  return out;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.done !== undefined) {
    fields.push('done = ?', 'done_at = ?');
    values.push(patch.done ? 1 : 0, patch.done ? nowIso() : null);
  }
  for (const key of ['title', 'notes', 'category_id', 'project_id', 'priority', 'day', 'sort_order'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return;
  fields.push('updated_at = ?');
  values.push(nowIso(), id);
  await db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function setDayMeta(day: string, patch: Partial<DayMeta>): Promise<void> {
  const db = await getDb();
  const existing = await db.all<DayMeta>('SELECT * FROM day_meta WHERE day = ?', [day]);
  if (!existing.length) {
    await db.run('INSERT INTO day_meta (day, note, mood, target) VALUES (?, ?, ?, ?)', [
      day,
      patch.note ?? null,
      patch.mood ?? null,
      patch.target ?? null,
    ]);
    return;
  }
  const next = { ...existing[0], ...patch };
  await db.run('UPDATE day_meta SET note = ?, mood = ?, target = ? WHERE day = ?', [
    next.note ?? null,
    next.mood ?? null,
    next.target ?? null,
    day,
  ]);
}

/* ---------------------------------- آمار ---------------------------------- */

type Counted = { day: string; done_count: number; total_count: number };

export async function countsInRange(from: string, to: string): Promise<Map<string, Counted>> {
  const db = await getDb();
  const rows = await db.all<{ day: string; done_count: number | string; total_count: number | string }>(
    `SELECT day,
            SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done_count,
            COUNT(*) AS total_count
       FROM tasks
      WHERE day >= ? AND day <= ?
      GROUP BY day`,
    [from, to],
  );
  const map = new Map<string, Counted>();
  for (const r of rows) {
    map.set(r.day, {
      day: r.day,
      done_count: Number(r.done_count),
      total_count: Number(r.total_count),
    });
  }
  return map;
}

export async function monthStats(days: string[], today: string): Promise<MonthStats> {
  const db = await getDb();
  const from = days[0];
  const to = days[days.length - 1];
  const counts = await countsInRange(from, to);

  const points: MonthPoint[] = days.map((day, i) => {
    const c = counts.get(day);
    return {
      day,
      index: i + 1,
      done: c?.done_count ?? 0,
      total: c?.total_count ?? 0,
      isFuture: day > today,
    };
  });

  const past = points.filter((p) => !p.isFuture);
  const totalDone = past.reduce((s, p) => s + p.done, 0);
  const totalTasks = past.reduce((s, p) => s + p.total, 0);
  const activeDays = past.filter((p) => p.done > 0).length;
  const bestDay = past.reduce<MonthPoint | null>(
    (best, p) => (best === null || p.done > best.done ? p : best),
    null,
  );

  // استریک: از امروز به عقب، روزهایی که حداقل یک تسک انجام شده
  const streakRows = await db.all<{ day: string }>(
    `SELECT DISTINCT day FROM tasks WHERE done = 1 AND day <= ? ORDER BY day DESC`,
    [today],
  );
  const doneDays = streakRows.map((r) => r.day);
  const doneSet = new Set(doneDays);

  let currentStreak = 0;
  {
    let cursor = today;
    if (!doneSet.has(cursor)) cursor = addDays(today, -1); // امروز هنوز تموم نشده
    while (doneSet.has(cursor)) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  let longestStreak = 0;
  {
    const asc = [...doneDays].sort();
    let run = 0;
    for (let i = 0; i < asc.length; i += 1) {
      run = i > 0 && diffDays(asc[i], asc[i - 1]) === 1 ? run + 1 : 1;
      if (run > longestStreak) longestStreak = run;
    }
  }

  const catRows = await db.all<{ category_id: string | null; done_count: number | string }>(
    `SELECT category_id, COUNT(*) AS done_count
       FROM tasks
      WHERE done = 1 AND day >= ? AND day <= ?
      GROUP BY category_id`,
    [from, to],
  );
  const categories = await listCategories();
  const byCategory = catRows
    .map((r) => {
      const cat = categories.find((c) => c.id === r.category_id);
      return {
        id: r.category_id,
        name: cat?.name ?? 'بدون دسته',
        color: cat?.color ?? 'slate',
        done: Number(r.done_count),
      };
    })
    .sort((a, b) => b.done - a.done);

  const byWeekday = Array.from({ length: 7 }, (_, index) => ({ index, done: 0, days: 0 }));
  for (const p of past) {
    const wd = weekdayIndex(p.day);
    byWeekday[wd].done += p.done;
    byWeekday[wd].days += 1;
  }

  return {
    points,
    totalDone,
    totalTasks,
    avgPerDay: past.length ? totalDone / past.length : 0,
    bestDay,
    activeDays,
    completionRate: totalTasks ? totalDone / totalTasks : 0,
    currentStreak,
    longestStreak,
    byCategory,
    byWeekday,
  };
}

export async function yearHeatmap(from: string, to: string) {
  const counts = await countsInRange(from, to);
  return Array.from(counts.values());
}

/* ---------------------------------- پروژه‌ها -------------------------------- */

export async function listProjects(): Promise<ProjectWithStats[]> {
  const db = await getDb();
  const projects = await db.all<Project>('SELECT * FROM projects ORDER BY created_at DESC');
  const rows = await db.all<{
    project_id: string;
    total: number | string;
    done_count: number | string;
    last_day: string | null;
  }>(
    `SELECT project_id,
            COUNT(*) AS total,
            SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done_count,
            MAX(day) AS last_day
       FROM tasks
      WHERE project_id IS NOT NULL
      GROUP BY project_id`,
  );
  const byId = new Map(rows.map((r) => [r.project_id, r]));
  return projects.map((p) => {
    const r = byId.get(p.id);
    return {
      ...p,
      totalTasks: r ? Number(r.total) : 0,
      doneTasks: r ? Number(r.done_count) : 0,
      lastActivity: r?.last_day ?? null,
    };
  });
}

export async function createProject(input: {
  name: string;
  client_name?: string | null;
  color?: string;
}): Promise<Project> {
  const db = await getDb();
  const row: Project = {
    id: newId(),
    name: input.name,
    client_name: input.client_name ?? null,
    color: input.color ?? 'blue',
    status: 'active',
    created_at: nowIso(),
  };
  await db.run(
    'INSERT INTO projects (id, name, client_name, color, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.name, row.client_name, row.color, row.status, row.created_at],
  );
  return row;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['name', 'client_name', 'color', 'status'] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return;
  values.push(id);
  await db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE tasks SET project_id = NULL WHERE project_id = ?', [id]);
  await db.run('DELETE FROM projects WHERE id = ?', [id]);
}

/* --------------------------------- تنظیمات --------------------------------- */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  const existing = await db.all('SELECT key FROM settings WHERE key = ?', [key]);
  if (existing.length) {
    await db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
  } else {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

export async function getTargets(): Promise<Targets> {
  const [daily, weekly] = await Promise.all([getSetting('target_daily'), getSetting('target_weekly')]);
  return { daily: daily ? Number(daily) : null, weekly: weekly ? Number(weekly) : null };
}

export async function setTargets(t: Partial<Targets>): Promise<void> {
  if (t.daily !== undefined) await setSetting('target_daily', String(t.daily ?? ''));
  if (t.weekly !== undefined) await setSetting('target_weekly', String(t.weekly ?? ''));
}

/* -------------------------------- مرور هفتگی -------------------------------- */

/** شنبه‌ی همون هفته (میلادی ISO) که این روز توش قرار داره */
function weekStartOf(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export async function getWeekSummary(anyDayInWeek: string): Promise<WeekSummary> {
  const weekStart = weekStartOf(anyDayInWeek);
  const weekEnd = addDays(weekStart, 6);
  const db = await getDb();

  const counts = await countsInRange(weekStart, weekEnd);
  const totalDone = [...counts.values()].reduce((s, c) => s + c.done_count, 0);
  const totalTasks = [...counts.values()].reduce((s, c) => s + c.total_count, 0);
  const activeDays = [...counts.values()].filter((c) => c.done_count > 0).length;
  const bestEntry = [...counts.values()].reduce<Counted | null>(
    (best, c) => (best === null || c.done_count > best.done_count ? c : best),
    null,
  );

  const catRows = await db.all<{ category_id: string | null; done_count: number | string }>(
    `SELECT category_id, COUNT(*) AS done_count
       FROM tasks
      WHERE done = 1 AND day >= ? AND day <= ?
      GROUP BY category_id`,
    [weekStart, weekEnd],
  );
  const categories = await listCategories();
  const byCategory = catRows
    .map((r) => {
      const cat = categories.find((c) => c.id === r.category_id);
      return {
        id: r.category_id,
        name: cat?.name ?? 'بدون دسته',
        color: cat?.color ?? 'slate',
        done: Number(r.done_count),
      };
    })
    .sort((a, b) => b.done - a.done);

  const noteRows = await db.all<{ focus: string | null }>(
    'SELECT focus FROM weekly_notes WHERE week_start = ?',
    [weekStart],
  );
  let focus: string[] = [];
  try {
    focus = noteRows[0]?.focus ? JSON.parse(noteRows[0].focus) : [];
  } catch {
    focus = [];
  }

  return {
    weekStart,
    weekEnd,
    totalDone,
    totalTasks,
    activeDays,
    bestDay: bestEntry ? { day: bestEntry.day, done: bestEntry.done_count } : null,
    byCategory,
    focus,
  };
}

export async function setWeeklyFocus(weekStart: string, focus: string[]): Promise<void> {
  const db = await getDb();
  const existing = await db.all('SELECT week_start FROM weekly_notes WHERE week_start = ?', [weekStart]);
  const json = JSON.stringify(focus.filter((f) => f.trim()).slice(0, 3));
  if (existing.length) {
    await db.run('UPDATE weekly_notes SET focus = ? WHERE week_start = ?', [json, weekStart]);
  } else {
    await db.run('INSERT INTO weekly_notes (week_start, summary, focus, created_at) VALUES (?, NULL, ?, ?)', [
      weekStart,
      json,
      nowIso(),
    ]);
  }
}

/* -------------------------------- بکاپ/اکسپورت ------------------------------- */

export async function exportAll(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const [tasks, categories, routines, projects, settings, weeklyNotes, routineDays, dayMeta] = await Promise.all([
    db.all('SELECT * FROM tasks'),
    db.all('SELECT * FROM categories'),
    db.all('SELECT * FROM routines'),
    db.all('SELECT * FROM projects'),
    db.all('SELECT * FROM settings'),
    db.all('SELECT * FROM weekly_notes'),
    db.all('SELECT * FROM routine_days'),
    db.all('SELECT * FROM day_meta'),
  ]);
  return {
    version: 1,
    exported_at: nowIso(),
    tasks,
    categories,
    routines,
    projects,
    settings,
    weekly_notes: weeklyNotes,
    routine_days: routineDays,
    day_meta: dayMeta,
  };
}

/** جایگزینیِ کامل — همه‌چیز قبلی پاک و با محتوای فایل جایگزین می‌شه */
export async function importAll(data: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const tables: [string, string[]][] = [
    ['tasks', ['id', 'title', 'notes', 'category_id', 'project_id', 'day', 'done', 'done_at', 'priority', 'routine_id', 'sort_order', 'created_at', 'updated_at']],
    ['categories', ['id', 'name', 'color', 'created_at']],
    ['routines', ['id', 'title', 'category_id', 'days', 'priority', 'active', 'start_date', 'created_at']],
    ['projects', ['id', 'name', 'client_name', 'color', 'status', 'created_at']],
    ['settings', ['key', 'value']],
    ['weekly_notes', ['week_start', 'summary', 'focus', 'created_at']],
    ['routine_days', ['day', 'routine_id']],
    ['day_meta', ['day', 'note', 'mood', 'target']],
  ];

  for (const [table, cols] of tables) {
    await db.run(`DELETE FROM ${table}`);
    const rows = (data[table] as Record<string, unknown>[] | undefined) ?? [];
    for (const row of rows) {
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => row[c] ?? null);
      await db.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values);
    }
  }
}
