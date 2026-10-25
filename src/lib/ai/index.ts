/**
 * لایه‌ی اتصال به APIهای رایگان هوش مصنوعی برای تولید متن (برای دستیارهایی مثل لینکدین).
 *
 * هر سه ارائه‌دهنده‌ی زیر یک سطح رایگان دارن:
 *  - Gemini   (Google AI Studio)  — GEMINI_API_KEY
 *  - Groq     (استنتاج سریع روی مدل‌های متن‌باز) — GROQ_API_KEY
 *  - OpenRouter (مدل‌های با پسوند :free) — OPENROUTER_API_KEY
 *
 * فقط env varهایی که مقدار دارن امتحان می‌شن — به ترتیب AI_PROVIDER_ORDER (پیش‌فرض: gemini,groq,openrouter)
 * تا سقف رایگان یکی تموم بشه یا کلیدش نباشه، بعدی امتحان می‌شه. هیچ کلیدی داخل کد یا دیتابیس ذخیره نمی‌شه —
 * همه از process.env خونده می‌شن (دقیقاً مثل APP_PASSWORD و DATABASE_URL).
 */

export type AiProvider = 'gemini' | 'groq' | 'openrouter';

export type AiResult = {
  text: string;
  provider: AiProvider;
  model: string;
  tokensUsed: number | null;
};

class AiProviderError extends Error {
  constructor(public provider: AiProvider, message: string) {
    super(message);
  }
}

function baseUrl(envKey: string, fallback: string): string {
  return process.env[envKey]?.trim() || fallback;
}

async function callGemini(prompt: string): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiProviderError('gemini', 'GEMINI_API_KEY ست نشده');

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const url = `${baseUrl('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiProviderError('gemini', `خطای Gemini (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new AiProviderError('gemini', 'Gemini خروجی خالی برگردوند (شاید فیلتر ایمنی زده)');
  const tokensUsed = data?.usageMetadata?.totalTokenCount ?? null;
  return { text: text.trim(), provider: 'gemini', model, tokensUsed };
}

async function callOpenAiCompatible(
  provider: 'groq' | 'openrouter',
  prompt: string,
  opts: { apiKeyEnv: string; baseUrlEnv: string; baseUrlDefault: string; modelEnv: string; modelDefault: string; extraHeaders?: Record<string, string> },
): Promise<AiResult> {
  const apiKey = process.env[opts.apiKeyEnv]?.trim();
  if (!apiKey) throw new AiProviderError(provider, `${opts.apiKeyEnv} ست نشده`);

  const model = process.env[opts.modelEnv]?.trim() || opts.modelDefault;
  const url = `${baseUrl(opts.baseUrlEnv, opts.baseUrlDefault)}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiProviderError(provider, `خطای ${provider} (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new AiProviderError(provider, `${provider} خروجی خالی برگردوند`);
  const tokensUsed = data?.usage?.total_tokens ?? null;
  return { text: text.trim(), provider, model, tokensUsed };
}

const callGroq = (prompt: string) =>
  callOpenAiCompatible('groq', prompt, {
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrlEnv: 'GROQ_BASE_URL',
    baseUrlDefault: 'https://api.groq.com/openai/v1',
    modelEnv: 'GROQ_MODEL',
    modelDefault: 'llama-3.3-70b-versatile',
  });

const callOpenRouter = (prompt: string) =>
  callOpenAiCompatible('openrouter', prompt, {
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    baseUrlDefault: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_MODEL',
    modelDefault: 'meta-llama/llama-3.3-70b-instruct:free',
    extraHeaders: { 'X-Title': 'Shenskho Personal Assistants' },
  });

const PROVIDER_CALLS: Record<AiProvider, (prompt: string) => Promise<AiResult>> = {
  gemini: callGemini,
  groq: callGroq,
  openrouter: callOpenRouter,
};

/** آیا حداقل یک کلید API هوش مصنوعی ست شده؟ */
export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

export function configuredProviders(): AiProvider[] {
  return providerOrder().filter((p) => {
    if (p === 'gemini') return Boolean(process.env.GEMINI_API_KEY?.trim());
    if (p === 'groq') return Boolean(process.env.GROQ_API_KEY?.trim());
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  });
}

function providerOrder(): AiProvider[] {
  const raw = process.env.AI_PROVIDER_ORDER?.trim();
  const order = (raw ? raw.split(',').map((s) => s.trim()) : ['gemini', 'groq', 'openrouter']) as AiProvider[];
  return order.filter((p): p is AiProvider => p === 'gemini' || p === 'groq' || p === 'openrouter');
}

/**
 * تولید متن با اولین ارائه‌دهنده‌ای که کلیدش ست شده و جواب داد.
 * اگر یکی خطا داد (مثلاً سقف رایگانش تموم شده)، خودکار سراغ بعدی می‌ره.
 */
export async function generateText(prompt: string): Promise<AiResult> {
  const order = providerOrder();
  const configured = order.filter((p) => {
    if (p === 'gemini') return Boolean(process.env.GEMINI_API_KEY?.trim());
    if (p === 'groq') return Boolean(process.env.GROQ_API_KEY?.trim());
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  });

  if (configured.length === 0) {
    throw new Error(
      'هیچ کلید API هوش مصنوعی‌ای ست نشده. یکی از GEMINI_API_KEY، GROQ_API_KEY یا OPENROUTER_API_KEY رو در .env.local بذار (راهنما در راهنمای-API-های-رایگان-AI.md).',
    );
  }

  const errors: string[] = [];
  for (const p of configured) {
    try {
      return await PROVIDER_CALLS[p](prompt);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`همه‌ی ارائه‌دهنده‌های پیکربندی‌شده شکست خوردن:\n${errors.join('\n')}`);
}
