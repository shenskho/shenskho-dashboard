/**
 * ابزارهایی که دستیار هوشمند می‌تونه روی داده‌ی داشبورد اجرا کنه.
 * همه از توابع repo.ts استفاده می‌کنن — یعنی دقیقاً همون منطقی که صفحه‌های خود اپ دارن.
 *
 * ابزارهای حذف (DESTRUCTIVE) هیچ‌وقت مستقیم اجرا نمی‌شن: دستیار فقط «درخواست تأیید» ثبت می‌کنه
 * و کاربر باید در رابط چت تأیید کنه (اجرای نهایی با executeConfirmed).
 */
import type { JsonSchema, ToolDef } from '../ai/chat';
import { WEEKDAYS, shortDate } from '../date/format';
import { jalaliToIso, todayIso } from '../date/jalali';
import { getDb } from '../db';
import {
  createCategory,
  createProject,
  createRoutine,
  createTask,
  deleteCategory,
  deleteProject,
  deleteRoutine,
  deleteTask,
  getDay,
  getWeekSummary,
  listCategories,
  listProjects,
  listRoutines,
  setDayMeta,
  setTargets,
  updateProject,
  updateRoutine,
  updateTask,
} from '../repo';
import { COLOR_KEYS } from '../types';

export type ToolOutcome = {
  ok: boolean;
  /** آنچه به مدل برمی‌گرده */
  data: unknown;
  /** یک خط فارسی برای نمایش در رابط */
  summary: string;
  mutated: boolean;
};

type Args = Record<string, unknown>;

/* ------------------------------- ابزارهای کمکی ------------------------------- */

/** یکسان‌سازی متن فارسی برای تطبیق اسم‌ها: ي/ك عربی، نیم‌فاصله، فاصله، حروف بزرگ */
function norm(s: string): string {
  return s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌\s]+/g, '').toLowerCase();
}

function resolveByName<T extends { id: string }>(items: T[], ref: unknown, nameOf: (x: T) => string, kind: string): T {
  const q = String(ref ?? '').trim();
  const byId = items.find((x) => x.id === q);
  if (byId) return byId;
  const n = norm(q);
  const exact = items.find((x) => norm(nameOf(x)) === n);
  if (exact) return exact;
  const partial = items.filter((x) => n && (norm(nameOf(x)).includes(n) || n.includes(norm(nameOf(x)))));
  if (partial.length === 1) return partial[0];
  const available = items.map(nameOf).join('، ') || '(هیچ‌کدام)';
  throw new Error(
    partial.length > 1
      ? `«${q}» با چند ${kind} جور درمیاد: ${partial.map(nameOf).join('، ')}`
      : `${kind} «${q}» پیدا نشد. موجودها: ${available}`,
  );
}

/** تاریخ باید YYYY-MM-DD میلادی باشه؛ اگر مدل اشتباهی تاریخ شمسی داد (سال < ۱۷۰۰) تبدیلش می‌کنیم */
function parseDay(v: unknown): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v ?? '').trim());
  if (!m) throw new Error(`تاریخ «${v}» معتبر نیست؛ قالب باید YYYY-MM-DD میلادی باشه`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`تاریخ «${v}» معتبر نیست`);
  if (y < 1700) return jalaliToIso(y, mo, d);
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parsePriority(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (![0, 1, 2].includes(n)) throw new Error('اولویت باید ۰ (کم)، ۱ (عادی) یا ۲ (مهم) باشه');
  return n;
}

function parseDays(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) throw new Error('days باید آرایه‌ای از اعداد ۰ تا ۶ باشه (۰=شنبه … ۶=جمعه)');
  const nums = [...new Set(v.map(Number))].sort((a, b) => a - b);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new Error('days فقط می‌تونه اعداد ۰ تا ۶ داشته باشه');
  return nums.join(',');
}

function colorOrUndefined(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const c = String(v);
  if (!COLOR_KEYS.includes(c)) throw new Error(`رنگ باید یکی از این‌ها باشه: ${COLOR_KEYS.join(', ')}`);
  return c;
}

const str = (v: unknown) => String(v ?? '').trim();

/* --------------------------------- تعریف‌ها --------------------------------- */

const S = (description: string): JsonSchema => ({ type: 'string', description });
const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: 'object', properties, required });

const DAY_DESC = 'Gregorian date as YYYY-MM-DD (always convert Jalali dates to Gregorian using the date table in the system prompt)';
const CAT_DESC = 'Category NAME (as shown in the system prompt). Omit if not specified.';
const PROJ_DESC = 'Project NAME (as shown in the system prompt). Omit if not specified.';
const PRIO_DESC = '0 = low, 1 = normal (default), 2 = important';
const DAYS_ARRAY: JsonSchema = {
  type: 'array',
  description: 'Weekday numbers where 0=Saturday, 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday',
  items: { type: 'integer' },
};

export const TOOLS: ToolDef[] = [
  {
    name: 'list_tasks',
    description: 'List all tasks (with ids and done status) of one day. Use it to find task ids before updating or deleting.',
    parameters: obj({ day: S(DAY_DESC) }, ['day']),
  },
  {
    name: 'add_tasks',
    description: 'Create one or more tasks. Put every task of the user request in a single call.',
    parameters: obj(
      {
        tasks: {
          type: 'array',
          description: 'Tasks to create',
          items: obj(
            {
              title: S('Task title, in the language the user wrote it'),
              day: S(DAY_DESC),
              category: S(CAT_DESC),
              project: S(PROJ_DESC),
              priority: { type: 'integer', description: PRIO_DESC },
              notes: S('Optional longer notes'),
            },
            ['title', 'day'],
          ),
        },
      },
      ['tasks'],
    ),
  },
  {
    name: 'update_task',
    description: 'Edit a task: rename, move to another day, change priority/category/project/notes. Use set_tasks_done to tick/untick.',
    parameters: obj(
      {
        id: S('Task id'),
        title: S('New title'),
        day: S(DAY_DESC),
        category: S(`${CAT_DESC} Empty string removes the category.`),
        project: S(`${PROJ_DESC} Empty string removes the project.`),
        priority: { type: 'integer', description: PRIO_DESC },
        notes: S('New notes'),
      },
      ['id'],
    ),
  },
  {
    name: 'set_tasks_done',
    description: 'Mark tasks as done (default) or not done.',
    parameters: obj(
      { ids: { type: 'array', description: 'Task ids', items: { type: 'string' } }, done: { type: 'boolean', description: 'true = done (default), false = undo' } },
      ['ids'],
    ),
  },
  {
    name: 'delete_task',
    description: 'Delete a task. The user must confirm in the UI before it actually happens.',
    parameters: obj({ id: S('Task id') }, ['id']),
  },
  {
    name: 'add_routine',
    description: 'Create a recurring routine that generates a task on the chosen weekdays.',
    parameters: obj(
      { title: S('Routine title'), days: DAYS_ARRAY, category: S(CAT_DESC), priority: { type: 'integer', description: PRIO_DESC }, start_date: S(`${DAY_DESC}. Defaults to today.`) },
      ['title'],
    ),
  },
  {
    name: 'update_routine',
    description: 'Edit a routine, or pause/resume it with active.',
    parameters: obj(
      {
        id: S('Routine id (from the system prompt)'),
        title: S('New title'),
        days: DAYS_ARRAY,
        category: S(CAT_DESC),
        priority: { type: 'integer', description: PRIO_DESC },
        active: { type: 'boolean', description: 'false pauses the routine' },
      },
      ['id'],
    ),
  },
  {
    name: 'delete_routine',
    description: 'Delete a routine (and its not-yet-done generated tasks). The user must confirm in the UI.',
    parameters: obj({ id: S('Routine id') }, ['id']),
  },
  {
    name: 'add_project',
    description: 'Create a project (optionally for a client).',
    parameters: obj({ name: S('Project name'), client_name: S('Client name'), color: { type: 'string', description: `One of: ${COLOR_KEYS.join(', ')}`, enum: COLOR_KEYS } }, ['name']),
  },
  {
    name: 'update_project',
    description: 'Edit a project or change its status (active, done, archived).',
    parameters: obj(
      {
        id: S('Project id or exact name'),
        name: S('New name'),
        client_name: S('New client name'),
        color: { type: 'string', description: `One of: ${COLOR_KEYS.join(', ')}`, enum: COLOR_KEYS },
        status: { type: 'string', description: 'Project status', enum: ['active', 'done', 'archived'] },
      },
      ['id'],
    ),
  },
  {
    name: 'delete_project',
    description: 'Delete a project (its tasks are kept, only unlinked). The user must confirm in the UI.',
    parameters: obj({ id: S('Project id or exact name') }, ['id']),
  },
  {
    name: 'add_category',
    description: 'Create a task category.',
    parameters: obj({ name: S('Category name'), color: { type: 'string', description: `One of: ${COLOR_KEYS.join(', ')}`, enum: COLOR_KEYS } }, ['name']),
  },
  {
    name: 'delete_category',
    description: 'Delete a category. The user must confirm in the UI.',
    parameters: obj({ id: S('Category id or exact name') }, ['id']),
  },
  {
    name: 'set_targets',
    description: 'Set the daily and/or weekly target number of completed tasks.',
    parameters: obj({ daily: { type: 'integer', description: 'Tasks per day' }, weekly: { type: 'integer', description: 'Tasks per week' } }),
  },
  {
    name: 'set_day_note',
    description: 'Set the free-text note of a day.',
    parameters: obj({ day: S(DAY_DESC), note: S('Note text') }, ['day', 'note']),
  },
  {
    name: 'week_summary',
    description: 'Get performance numbers of the week containing the given day (done/total, best day, by category).',
    parameters: obj({ day: S(DAY_DESC) }, ['day']),
  },
];

/** ابزارهایی که فقط بعد از تأیید کاربر اجرا می‌شن */
export const DESTRUCTIVE = new Set(['delete_task', 'delete_routine', 'delete_project', 'delete_category']);

/* --------------------------------- اجراکننده‌ها --------------------------------- */

const taskView = (t: { id: string; title: string; done: number; priority: number; category_id: string | null; project_id: string | null }) => ({
  id: t.id,
  title: t.title,
  done: t.done === 1,
  priority: t.priority,
  category_id: t.category_id,
  project_id: t.project_id,
});

type Executor = (a: Args) => Promise<Omit<ToolOutcome, 'ok' | 'mutated'> & { mutated?: boolean }>;

const EXECUTORS: Record<string, Executor> = {
  async list_tasks(a) {
    const day = parseDay(a.day);
    const payload = await getDay(day);
    return { data: { day, tasks: payload.tasks.map(taskView) }, summary: `${payload.tasks.length} تسک ${shortDate(day, 'jalali')} خوانده شد` };
  },

  async add_tasks(a) {
    if (!Array.isArray(a.tasks) || a.tasks.length === 0) throw new Error('tasks باید آرایه‌ی غیرخالی باشه');
    const [cats, projs] = await Promise.all([listCategories(), listProjects()]);
    // اول همه‌چیز اعتبارسنجی می‌شه تا یا همه ساخته بشن یا هیچ‌کدام
    const prepared = a.tasks.map((raw) => {
      const t = raw as Args;
      const title = str(t.title);
      if (!title) throw new Error('عنوان تسک خالیه');
      return {
        title,
        day: parseDay(t.day),
        category_id: t.category ? resolveByName(cats, t.category, (c) => c.name, 'دسته').id : null,
        project_id: t.project ? resolveByName(projs, t.project, (p) => p.name, 'پروژه').id : null,
        priority: parsePriority(t.priority),
        notes: t.notes ? str(t.notes) : null,
      };
    });
    const created = [];
    for (const p of prepared) created.push(await createTask(p));
    return {
      data: { created: created.map((t) => ({ id: t.id, title: t.title, day: t.day })) },
      summary: created.length === 1 ? `تسک «${created[0].title}» برای ${shortDate(created[0].day, 'jalali')} اضافه شد` : `${created.length} تسک اضافه شد`,
      mutated: true,
    };
  },

  async update_task(a) {
    const id = str(a.id);
    const existing = (await (await getDb()).all<{ id: string; title: string }>('SELECT id, title FROM tasks WHERE id = ?', [id]))[0];
    if (!existing) throw new Error(`تسکی با id «${id}» پیدا نشد؛ اول list_tasks بزن`);
    const patch: Parameters<typeof updateTask>[1] = {};
    if (a.title !== undefined) patch.title = str(a.title);
    if (a.day !== undefined) patch.day = parseDay(a.day);
    if (a.notes !== undefined) patch.notes = str(a.notes) || null;
    const prio = parsePriority(a.priority);
    if (prio !== undefined) patch.priority = prio;
    if (a.category !== undefined) patch.category_id = str(a.category) ? resolveByName(await listCategories(), a.category, (c) => c.name, 'دسته').id : null;
    if (a.project !== undefined) patch.project_id = str(a.project) ? resolveByName(await listProjects(), a.project, (p) => p.name, 'پروژه').id : null;
    await updateTask(id, patch);
    return { data: { updated: id, changes: Object.keys(patch) }, summary: `تسک «${existing.title}» ویرایش شد`, mutated: true };
  },

  async set_tasks_done(a) {
    const ids = Array.isArray(a.ids) ? a.ids.map(str).filter(Boolean) : [];
    if (!ids.length) throw new Error('ids خالیه');
    const done = a.done === undefined ? true : Boolean(a.done);
    const db = await getDb();
    const found = new Set<string>();
    for (const id of ids) {
      if ((await db.all('SELECT id FROM tasks WHERE id = ?', [id])).length) {
        await updateTask(id, { done: done ? 1 : 0 });
        found.add(id);
      }
    }
    const missing = ids.filter((id) => !found.has(id));
    if (!found.size) throw new Error(`هیچ تسکی با این idها پیدا نشد: ${missing.join(', ')}`);
    return {
      data: { updated: [...found], missing },
      summary: `${found.size} تسک ${done ? 'انجام‌شده' : 'انجام‌نشده'} شد`,
      mutated: true,
    };
  },

  async add_routine(a) {
    const title = str(a.title);
    if (!title) throw new Error('عنوان روتین خالیه');
    const cats = await listCategories();
    const routine = await createRoutine({
      title,
      days: a.days === undefined ? undefined : parseDays(a.days),
      category_id: a.category ? resolveByName(cats, a.category, (c) => c.name, 'دسته').id : null,
      priority: parsePriority(a.priority),
      start_date: a.start_date ? parseDay(a.start_date) : todayIso(),
    });
    const names = routine.days.split(',').map((d) => WEEKDAYS[Number(d)]).join('، ');
    return { data: { id: routine.id, title: routine.title, days: routine.days }, summary: `روتین «${title}» (${names}) اضافه شد`, mutated: true };
  },

  async update_routine(a) {
    const id = str(a.id);
    const routine = resolveByName(await listRoutines(), id, (r) => r.title, 'روتین');
    const patch: Parameters<typeof updateRoutine>[1] = {};
    if (a.title !== undefined) patch.title = str(a.title);
    if (a.days !== undefined) patch.days = parseDays(a.days);
    if (a.active !== undefined) patch.active = a.active ? 1 : 0;
    const prio = parsePriority(a.priority);
    if (prio !== undefined) patch.priority = prio;
    if (a.category !== undefined) patch.category_id = str(a.category) ? resolveByName(await listCategories(), a.category, (c) => c.name, 'دسته').id : null;
    await updateRoutine(routine.id, patch);
    return { data: { updated: routine.id, changes: Object.keys(patch) }, summary: `روتین «${routine.title}» ویرایش شد`, mutated: true };
  },

  async delete_routine(a) {
    const routine = resolveByName(await listRoutines(), a.id, (r) => r.title, 'روتین');
    await deleteRoutine(routine.id);
    return { data: { deleted: routine.id }, summary: `روتین «${routine.title}» حذف شد`, mutated: true };
  },

  async add_project(a) {
    const name = str(a.name);
    if (!name) throw new Error('نام پروژه خالیه');
    const p = await createProject({ name, client_name: a.client_name ? str(a.client_name) : null, color: colorOrUndefined(a.color) });
    return { data: { id: p.id, name: p.name }, summary: `پروژه «${name}» ساخته شد`, mutated: true };
  },

  async update_project(a) {
    const p = resolveByName(await listProjects(), a.id, (x) => x.name, 'پروژه');
    const patch: Parameters<typeof updateProject>[1] = {};
    if (a.name !== undefined) patch.name = str(a.name);
    if (a.client_name !== undefined) patch.client_name = str(a.client_name) || null;
    const color = colorOrUndefined(a.color);
    if (color) patch.color = color;
    if (a.status !== undefined) {
      if (!['active', 'done', 'archived'].includes(str(a.status))) throw new Error('status باید active، done یا archived باشه');
      patch.status = str(a.status) as 'active' | 'done' | 'archived';
    }
    await updateProject(p.id, patch);
    return { data: { updated: p.id, changes: Object.keys(patch) }, summary: `پروژه «${p.name}» ویرایش شد`, mutated: true };
  },

  async delete_project(a) {
    const p = resolveByName(await listProjects(), a.id, (x) => x.name, 'پروژه');
    await deleteProject(p.id);
    return { data: { deleted: p.id }, summary: `پروژه «${p.name}» حذف شد`, mutated: true };
  },

  async add_category(a) {
    const name = str(a.name);
    if (!name) throw new Error('نام دسته خالیه');
    const c = await createCategory(name, colorOrUndefined(a.color) ?? 'slate');
    return { data: { id: c.id, name: c.name }, summary: `دسته «${name}» ساخته شد`, mutated: true };
  },

  async delete_category(a) {
    const c = resolveByName(await listCategories(), a.id, (x) => x.name, 'دسته');
    await deleteCategory(c.id);
    return { data: { deleted: c.id }, summary: `دسته «${c.name}» حذف شد`, mutated: true };
  },

  async set_targets(a) {
    const patch: { daily?: number | null; weekly?: number | null } = {};
    for (const k of ['daily', 'weekly'] as const) {
      if (a[k] === undefined) continue;
      const n = Number(a[k]);
      if (!Number.isInteger(n) || n < 0 || n > 200) throw new Error(`هدف ${k} باید عدد صحیح بین ۰ و ۲۰۰ باشه`);
      patch[k] = n;
    }
    if (!Object.keys(patch).length) throw new Error('حداقل یکی از daily یا weekly لازمه');
    await setTargets(patch);
    return { data: patch, summary: 'هدف‌گذاری به‌روز شد', mutated: true };
  },

  async set_day_note(a) {
    const day = parseDay(a.day);
    await setDayMeta(day, { note: str(a.note) || null });
    return { data: { day }, summary: `یادداشت ${shortDate(day, 'jalali')} ثبت شد`, mutated: true };
  },

  async week_summary(a) {
    const s = await getWeekSummary(parseDay(a.day));
    return { data: s, summary: `خلاصه‌ی هفته‌ی ${shortDate(s.weekStart, 'jalali')} خوانده شد` };
  },
};

/** اجرای یک ابزار؛ خطاها به‌جای پرتاب شدن، به‌صورت نتیجه‌ی ok:false به مدل برمی‌گردن تا خودش اصلاح کنه */
export async function runTool(name: string, args: Args): Promise<ToolOutcome> {
  const exec = EXECUTORS[name];
  if (!exec) return { ok: false, data: { error: `ابزار ${name} وجود نداره` }, summary: `ابزار ناشناخته: ${name}`, mutated: false };
  try {
    const r = await exec(args);
    return { ok: true, data: r.data, summary: r.summary, mutated: r.mutated ?? false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, data: { error: message }, summary: message, mutated: false };
  }
}

/** متن فارسی «چی قراره حذف بشه» برای کارت تأیید */
export async function describeDestructive(name: string, args: Args): Promise<string> {
  try {
    const db = await getDb();
    if (name === 'delete_task') {
      const t = (await db.all<{ title: string; day: string }>('SELECT title, day FROM tasks WHERE id = ?', [str(args.id)]))[0];
      return t ? `حذف تسک «${t.title}» (${shortDate(t.day, 'jalali')})` : 'حذف یک تسک (پیدا نشد)';
    }
    if (name === 'delete_routine') return `حذف روتین «${resolveByName(await listRoutines(), args.id, (r) => r.title, 'روتین').title}»`;
    if (name === 'delete_project') return `حذف پروژه «${resolveByName(await listProjects(), args.id, (p) => p.name, 'پروژه').name}»`;
    if (name === 'delete_category') return `حذف دسته «${resolveByName(await listCategories(), args.id, (c) => c.name, 'دسته').name}»`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return name;
}

/** اجرای عملیات حذف پس از تأیید کاربر (فقط ابزارهای DESTRUCTIVE) */
export async function executeConfirmed(name: string, args: Args): Promise<ToolOutcome> {
  if (!DESTRUCTIVE.has(name)) {
    return { ok: false, data: { error: 'این عملیات نیازی به تأیید ندارد' }, summary: 'عملیات نامعتبر', mutated: false };
  }
  if (name === 'delete_task') {
    const id = str(args.id);
    const t = (await (await getDb()).all<{ title: string }>('SELECT title FROM tasks WHERE id = ?', [id]))[0];
    if (!t) return { ok: false, data: { error: 'تسک پیدا نشد' }, summary: 'تسک پیدا نشد (شاید قبلاً حذف شده)', mutated: false };
    await deleteTask(id);
    return { ok: true, data: { deleted: id }, summary: `تسک «${t.title}» حذف شد`, mutated: true };
  }
  return runTool(name, args);
}
