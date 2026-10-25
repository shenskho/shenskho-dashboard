/**
 * حلقه‌ی دستیار هوشمند: پیام کاربر → مدل → (ابزار → مدل)* → پاسخ نهایی.
 *
 * - تاریخ امروز، دسته‌ها، پروژه‌ها، روتین‌ها و تسک‌های امروز در پرامپت سیستم تزریق می‌شن تا مدل
 *   بدون پرسیدن بتونه اسم‌ها و «فردا / جمعه» رو به id و تاریخ دقیق تبدیل کنه.
 * - ابزارهای حذف اجرا نمی‌شن؛ به‌صورت pending برمی‌گردن تا کاربر در رابط تأیید کنه.
 */
import { chatWithTools, type ToolCall, type ToolResult, type Turn } from '../ai/chat';
import { WEEKDAYS, longDate } from '../date/format';
import { addDays, todayIso } from '../date/jalali';
import { getDay, getTargets, listCategories, listProjects, listRoutines } from '../repo';
import { describeDestructive, DESTRUCTIVE, runTool, TOOLS } from './tools';

export type ChatMessage = { role: 'user' | 'assistant'; text: string };
export type AssistantAction = { tool: string; ok: boolean; summary: string };
export type PendingAction = { id: string; tool: string; args: Record<string, unknown>; summary: string };
export type AssistantReply = {
  reply: string;
  actions: AssistantAction[];
  pending: PendingAction[];
  mutated: boolean;
  provider: string;
  model: string;
};

const MAX_STEPS = 6;
const MAX_HISTORY = 20;

async function buildSystemPrompt(): Promise<string> {
  const today = todayIso();
  const [cats, projects, routines, dayPayload, targets] = await Promise.all([
    listCategories(),
    listProjects(),
    listRoutines(),
    getDay(today),
    getTargets(),
  ]);

  const dateTable = Array.from({ length: 15 }, (_, i) => {
    const d = addDays(today, i - 1);
    const label = i === 0 ? 'دیروز' : i === 1 ? 'امروز' : i === 2 ? 'فردا' : i === 3 ? 'پس‌فردا' : '';
    return `- ${d} = ${longDate(d, 'jalali')}${label ? ` (${label})` : ''}`;
  }).join('\n');

  const taskLines =
    dayPayload.tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.title} (id: ${t.id})`).join('\n') || '(امروز تسکی ثبت نشده)';

  return `تو دستیار هوشمند «داشبورد شخصی» هستی؛ اپی که کاربر در اون تسک‌های روزانه، روتین‌ها، پروژه‌ها و چارت عملکردش رو مدیریت می‌کنه.
کاربر به فارسی (محاوره‌ای) باهات حرف می‌زنه و تو با ابزارها مستقیماً داده‌ی اپ رو تغییر می‌دی. همیشه کوتاه و دوستانه به فارسی جواب بده.

قواعد:
- هر کاری که کاربر خواست رو با ابزار انجام بده، نه این‌که فقط بگی انجام می‌دی. بعد از اجرا، در یک یا دو جمله بگو چی شد.
- تاریخ‌ها رو همیشه میلادی YYYY-MM-DD به ابزارها بده. «امروز/فردا/جمعه/۲۵ مهر» رو با جدول زیر تبدیل کن. اگر تاریخ مشخص نبود، امروز رو فرض کن.
- برای دسته و پروژه فقط اسمی که در فهرست پایین هست رو بنویس. اگر چنین دسته/پروژه‌ای نیست و کاربر هم نخواسته، نساز؛ بدون دسته ثبتش کن و بگو.
- برای ویرایش، انجام‌دادن یا حذف تسک‌های روزهای دیگه، اول list_tasks بزن تا idها رو داشته باشی. هیچ‌وقت id حدس نزن.
- چند تسک در یک درخواست = یک بار add_tasks با همه‌شون.
- ابزارهای حذف خودشون اجرا نمی‌شن؛ کاربر باید در صفحه تأیید کنه. بعد از صدا زدن، فقط بگو «برای تأیید حذف، دکمه‌ی تأیید رو بزن».
- اگر درخواست مبهمه (مثلاً کدوم تسک؟)، یک سؤال کوتاه بپرس. اگر خارج از توانت بود (مثلاً تغییر خود کد اپ)، صادقانه بگو.
- نتیجه‌ی ابزارها رو اختراع نکن؛ فقط چیزی که ابزار برگردونده رو گزارش کن.

امروز: ${today} = ${longDate(today, 'jalali')}
هفته از شنبه شروع می‌شه (شماره‌ی روز: ${WEEKDAYS.map((w, i) => `${i}=${w}`).join('، ')}).

جدول تاریخ‌ها:
${dateTable}

دسته‌ها: ${cats.map((c) => c.name).join('، ') || '(ندارد)'}
پروژه‌های فعال: ${
    projects
      .filter((p) => p.status === 'active')
      .map((p) => `${p.name}${p.client_name ? ` [مشتری: ${p.client_name}]` : ''} (${p.doneTasks}/${p.totalTasks})`)
      .join('، ') || '(ندارد)'
  }
روتین‌ها: ${routines.map((r) => `${r.title}${r.active ? '' : ' [متوقف]'} (id: ${r.id}, روزها: ${r.days})`).join('؛ ') || '(ندارد)'}
هدف روزانه: ${targets.daily ?? 'تنظیم نشده'} · هدف هفتگی: ${targets.weekly ?? 'تنظیم نشده'}

تسک‌های امروز:
${taskLines}`;
}

export async function runAssistant(history: ChatMessage[]): Promise<AssistantReply> {
  const system = await buildSystemPrompt();
  const turns: Turn[] = history.slice(-MAX_HISTORY).map((m): Turn =>
    m.role === 'user' ? { role: 'user', text: m.text } : { role: 'assistant', text: m.text },
  );

  const actions: AssistantAction[] = [];
  const pending: PendingAction[] = [];
  let mutated = false;
  let provider = '';
  let model = '';
  let lastText = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await chatWithTools(system, turns, TOOLS);
    provider = res.provider;
    model = res.model;
    if (res.text) lastText = res.text;

    if (res.calls.length === 0) {
      return { reply: res.text, actions, pending, mutated, provider, model };
    }

    turns.push({ role: 'assistant', text: res.text, calls: res.calls, raw: res.raw });
    const results: ToolResult[] = [];

    for (const call of res.calls as ToolCall[]) {
      if (DESTRUCTIVE.has(call.name)) {
        const summary = await describeDestructive(call.name, call.args);
        pending.push({ id: `${Date.now().toString(36)}-${pending.length}`, tool: call.name, args: call.args, summary });
        results.push({ id: call.id, name: call.name, result: { status: 'awaiting_user_confirmation', note: 'Nothing was deleted yet. The user must confirm in the UI.' } });
        continue;
      }
      const outcome = await runTool(call.name, call.args);
      if (outcome.mutated) mutated = true;
      actions.push({ tool: call.name, ok: outcome.ok, summary: outcome.summary });
      results.push({ id: call.id, name: call.name, result: outcome.data });
    }
    turns.push({ role: 'tool', results });
  }

  return {
    reply: lastText || 'کار طولانی شد و نیمه‌کاره موند؛ لطفاً درخواست رو کوچیک‌تر یا دقیق‌تر بفرست.',
    actions,
    pending,
    mutated,
    provider,
    model,
  };
}
