/**
 * لایه‌ی داده با دو آداپتور:
 *  - SQLite لوکال  (پیش‌فرض، بدون نیاز به اینترنت)  →  DATABASE_URL خالی یا file:...
 *  - Postgres ابری (Neon / Supabase / Vercel Postgres) →  DATABASE_URL=postgres://...
 *
 * کوئری‌ها همه‌جا با علامت ? نوشته می‌شن؛ آداپتور Postgres خودش به $1,$2,... تبدیل می‌کنه.
 */

export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  kind: 'sqlite' | 'postgres';
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS categories (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     color TEXT NOT NULL DEFAULT 'slate',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS routines (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     category_id TEXT,
     days TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
     priority INTEGER NOT NULL DEFAULT 1,
     active INTEGER NOT NULL DEFAULT 1,
     start_date TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS tasks (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     notes TEXT,
     category_id TEXT,
     day TEXT NOT NULL,
     done INTEGER NOT NULL DEFAULT 0,
     done_at TEXT,
     priority INTEGER NOT NULL DEFAULT 1,
     routine_id TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks (day)`,
  `CREATE TABLE IF NOT EXISTS routine_days (
     day TEXT NOT NULL,
     routine_id TEXT NOT NULL,
     PRIMARY KEY (day, routine_id)
   )`,
  `CREATE TABLE IF NOT EXISTS day_meta (
     day TEXT PRIMARY KEY,
     note TEXT,
     mood INTEGER,
     target INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     client_name TEXT,
     color TEXT NOT NULL DEFAULT 'blue',
     status TEXT NOT NULL DEFAULT 'active',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS weekly_notes (
     week_start TEXT PRIMARY KEY,
     summary TEXT,
     focus TEXT,
     created_at TEXT NOT NULL
   )`,
];

/** ستون‌های تازه که به جدول‌های قدیمی اضافه می‌شن — خطای «قبلاً وجود داره» نادیده گرفته می‌شه */
const ALTERS = [`ALTER TABLE tasks ADD COLUMN project_id TEXT`];

let cached: Promise<Db> | null = null;

async function createSqlite(url: string): Promise<Db> {
  const { default: Database } = await import('better-sqlite3');
  const path = await import('node:path');
  const fs = await import('node:fs');

  const file = url.startsWith('file:') ? url.slice(5) : url;
  const abs = path.isAbsolute(file) ? file : `${process.cwd()}/${file.replace(/^\.\//, '')}`;
  fs.mkdirSync(abs.slice(0, abs.lastIndexOf('/')) || '.', { recursive: true });

  const db = new Database(abs);
  db.pragma('journal_mode = WAL');

  return {
    kind: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...(params as never[]));
    },
  };
}

function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${(i += 1)}`);
}

async function createPostgres(url: string): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
    max: 5,
  });

  return {
    kind: 'postgres',
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPgSql(sql), params as never[]);
      return res.rows as T[];
    },
    async run(sql: string, params: unknown[] = []) {
      await pool.query(toPgSql(sql), params as never[]);
    },
  };
}

async function migrate(db: Db) {
  for (const stmt of SCHEMA) await db.run(stmt);
  for (const stmt of ALTERS) {
    try {
      await db.run(stmt);
    } catch {
      // ستون از قبل وجود داره — بی‌خیال
    }
  }
}

/** نمونه‌ی دیتابیس (یک بار ساخته و کش می‌شه) */
export function getDb(): Promise<Db> {
  if (!cached) {
    const url = process.env.DATABASE_URL?.trim() || 'file:./data/shenskho.db';
    const isPg = url.startsWith('postgres://') || url.startsWith('postgresql://');
    cached = (isPg ? createPostgres(url) : createSqlite(url)).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return cached;
}

export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
