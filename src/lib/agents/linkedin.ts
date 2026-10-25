/**
 * دستیار «تولید محتوای لینکدین» — اولین دستیار واقعی (فاز ۴).
 * فقط از تسک‌های واقعاً انجام‌شده‌ی خودِ کاربر الهام می‌گیره (چیزی از خودش اختراع نمی‌کنه)،
 * با توجه به حقیقت‌های تأییدشده‌ی حافظه‌ی مشترک (زبان، سبک نوشتاری) یک پیش‌نویس می‌سازه،
 * و آن را فقط به‌صورت «پیشنهاد» در صندوق تأیید می‌ذاره — هرگز خودش منتشر نمی‌کنه.
 */
import { generateText } from '../ai';
import {
  createAgentRun,
  finishAgentRun,
  getAgentBySlug,
  listMemoryFacts,
  proposeOutput,
  recentDoneTasks,
} from '../repo';
import type { AgentRun } from '../types';

const AGENT_SLUG = 'linkedin-content';
const LOOKBACK_DAYS = 7;

export class LinkedInAgentError extends Error {}

function buildPrompt(tasks: { title: string; category: string | null; project: string | null }[], facts: Map<string, string>): string {
  const taskLines = tasks
    .slice(0, 25)
    .map((t) => `- ${t.title}${t.project ? ` (پروژه: ${t.project})` : ''}${t.category ? ` [${t.category}]` : ''}`)
    .join('\n');

  const style = facts.get('linkedin-style') || 'پست کوتاه (۱۲۰-۲۰۰ کلمه)، هوک در دو خط اول، ۲-۳ نکته‌ی کوتاه، حداکثر ۲ هشتگ، بدون لینک بیرونی، سؤال پایانی مشخص.';
  const jobTarget = facts.get('job-target');

  return `تو دستیار نوشتن پست لینکدین برای یک برنامه‌نویس وب فریلنسر هستی که دنبال فرصت شغلی می‌گرده${jobTarget ? ` (هدف: ${jobTarget})` : ''}.

فقط و فقط بر اساس فهرست کارهای واقعی زیر که این کاربر در ${LOOKBACK_DAYS} روز اخیر انجام داده، یک پست لینکدین فارسی بنویس.
هیچ دستاورد یا جزئیات فنی‌ای که در این فهرست نیست رو اختراع نکن — اگر فهرست کلی بود، پست رو هم کلی و صادقانه بنویس.

فهرست کارهای انجام‌شده:
${taskLines || '(فهرستی ثبت نشده)'}

سبک نوشتاری الزامی:
${style}

فقط متن نهایی پست رو بنویس، بدون توضیح اضافه یا عنوان.`;
}

export async function runLinkedInAgent(): Promise<AgentRun> {
  const agent = await getAgentBySlug(AGENT_SLUG);
  if (!agent) throw new LinkedInAgentError('دستیار لینکدین پیدا نشد — دیتابیس seed نشده؟');

  const run = await createAgentRun(agent.id);

  try {
    const [tasks, approvedFacts] = await Promise.all([recentDoneTasks(LOOKBACK_DAYS), listMemoryFacts('approved')]);

    if (tasks.length === 0) {
      await finishAgentRun(run.id, {
        status: 'error',
        error: `هیچ تسک انجام‌شده‌ای در ${LOOKBACK_DAYS} روز اخیر ثبت نشده — چیزی برای نوشتن پست نیست.`,
      });
      return { ...run, status: 'error', error: 'هیچ تسک انجام‌شده‌ای ثبت نشده' };
    }

    const factMap = new Map(approvedFacts.map((f) => [f.key, f.value]));
    const prompt = buildPrompt(tasks, factMap);
    const result = await generateText(prompt);

    await proposeOutput({
      agentId: agent.id,
      title: `پیش‌نویس پست لینکدین — ${new Date().toISOString().slice(0, 10)}`,
      content: result.text,
      meta: { provider: result.provider, model: result.model, taskCount: tasks.length },
    });

    await finishAgentRun(run.id, {
      status: 'success',
      summary: `یک پیش‌نویس پست بر اساس ${tasks.length} تسک انجام‌شده ساخته شد (${result.provider}/${result.model}) و در صف تأیید قرار گرفت.`,
      tokensUsed: result.tokensUsed ?? undefined,
      costUsd: 0,
    });

    return { ...run, status: 'success' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await finishAgentRun(run.id, { status: 'error', error: message });
    return { ...run, status: 'error', error: message };
  }
}
