import { NextResponse } from 'next/server';
import { exportAll } from '@/lib/repo';
import { todayIso } from '@/lib/date/jalali';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format');
  const data = await exportAll();

  if (format === 'csv') {
    const tasks = data.tasks as Record<string, unknown>[];
    const cols = ['day', 'title', 'done', 'priority', 'category_id', 'project_id', 'created_at'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...tasks.map((t) => cols.map((c) => esc(t[c])).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shenskho-tasks-${todayIso()}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="shenskho-backup-${todayIso()}.json"`,
    },
  });
}
