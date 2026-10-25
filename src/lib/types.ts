export type Task = {
  id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  project_id: string | null;
  day: string; // YYYY-MM-DD میلادی
  done: number; // 0 | 1
  done_at: string | null;
  priority: number; // 0 کم، 1 عادی، 2 مهم
  routine_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  client_name: string | null;
  color: string;
  status: 'active' | 'done' | 'archived';
  created_at: string;
};

export type ProjectWithStats = Project & {
  totalTasks: number;
  doneTasks: number;
  lastActivity: string | null;
};

export type Targets = {
  daily: number | null;
  weekly: number | null;
};

export type WeeklyNote = {
  week_start: string;
  summary: string | null;
  focus: string | null; // JSON-encoded string[]
  created_at: string;
};

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  totalDone: number;
  totalTasks: number;
  activeDays: number;
  bestDay: { day: string; done: number } | null;
  byCategory: { id: string | null; name: string; color: string; done: number }[];
  focus: string[];
};

export type Category = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type Routine = {
  id: string;
  title: string;
  category_id: string | null;
  days: string; // «0,1,2» با شروع از شنبه
  priority: number;
  active: number;
  start_date: string;
  created_at: string;
};

export type DayMeta = {
  day: string;
  note: string | null;
  mood: number | null;
  target: number | null;
};

export type DayPayload = {
  day: string;
  tasks: Task[];
  categories: Category[];
  meta: DayMeta | null;
};

export type MonthPoint = {
  day: string;
  index: number; // شماره‌ی روز در ماه
  done: number;
  total: number;
  isFuture: boolean;
};

export type MonthStats = {
  points: MonthPoint[];
  totalDone: number;
  totalTasks: number;
  avgPerDay: number;
  bestDay: MonthPoint | null;
  activeDays: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  byCategory: { id: string | null; name: string; color: string; done: number }[];
  byWeekday: { index: number; done: number; days: number }[];
};

/**
 * پالت دسته‌ای، به همان ترتیب ثابتی که از نظر کوررنگی امن است.
 * هر رنگ دو مقدار دارد: تم روشن و تم تیره.
 */
export const COLORS: Record<string, { light: string; dark: string; label: string }> = {
  blue: { light: '#2a78d6', dark: '#3987e5', label: 'آبی' },
  orange: { light: '#eb6834', dark: '#d95926', label: 'نارنجی' },
  aqua: { light: '#1baf7a', dark: '#199e70', label: 'فیروزه‌ای' },
  yellow: { light: '#eda100', dark: '#c98500', label: 'زرد' },
  magenta: { light: '#e87ba4', dark: '#d55181', label: 'صورتی' },
  green: { light: '#008300', dark: '#008300', label: 'سبز' },
  violet: { light: '#4a3aa7', dark: '#9085e9', label: 'بنفش' },
  red: { light: '#e34948', dark: '#e66767', label: 'قرمز' },
  slate: { light: '#898781', dark: '#898781', label: 'خاکستری' },
};

export const COLOR_KEYS = Object.keys(COLORS);

/** رنگ دسته را برای تم فعلی برمی‌گرداند (در CSS با متغیر هم قابل استفاده است) */
export function colorOf(key: string | null | undefined, theme: 'light' | 'dark' = 'dark'): string {
  return (COLORS[key ?? 'slate'] ?? COLORS.slate)[theme];
}
