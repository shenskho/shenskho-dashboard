/**
 * گفتگوی ابزارمحور (tool-calling) با APIهای رایگان هوش مصنوعی.
 *
 * فرق با generateText در index.ts: اینجا مدل می‌تونه به‌جای متن، «درخواست اجرای ابزار» برگردونه
 * و ما نتیجه‌ی ابزار رو دوباره بهش بدیم. ترتیب و fallback بین Gemini / Groq / OpenRouter همونه
 * (AI_PROVIDER_ORDER و کلیدهای محیطی) — فقط قالب پیام‌ها برای هر ارائه‌دهنده جداگانه ترجمه می‌شه.
 */
import { configuredProviders, type AiProvider } from './index';

export type JsonSchema = {
  type: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array';
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

export type ToolDef = { name: string; description: string; parameters: JsonSchema };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ToolResult = { id: string; name: string; result: unknown };

export type Turn =
  | { role: 'user'; text: string }
  /** raw: بخش‌های اصلی پاسخ مدل (Gemini برای برخی مدل‌ها امضای thought لازم داره و باید عیناً برگرده) */
  | { role: 'assistant'; text?: string; calls?: ToolCall[]; raw?: unknown }
  | { role: 'tool'; results: ToolResult[] };

export type ChatResult = {
  text: string;
  calls: ToolCall[];
  raw?: unknown;
  provider: AiProvider;
  model: string;
  tokensUsed: number | null;
};

class ChatProviderError extends Error {}

const env = (key: string) => process.env[key]?.trim() || undefined;

/* --------------------------------- Gemini --------------------------------- */

function toGeminiSchema(s: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: s.type.toUpperCase() };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    if (s.required?.length) out.required = s.required;
  }
  return out;
}

function geminiContents(turns: Turn[]): unknown[] {
  return turns.map((t) => {
    if (t.role === 'user') return { role: 'user', parts: [{ text: t.text }] };
    if (t.role === 'tool') {
      return {
        role: 'user',
        parts: t.results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })),
      };
    }
    if (Array.isArray(t.raw) && t.raw.length) return { role: 'model', parts: t.raw };
    const parts: unknown[] = [];
    if (t.text) parts.push({ text: t.text });
    for (const c of t.calls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } });
    return { role: 'model', parts };
  });
}

async function chatGemini(system: string, turns: Turn[], tools: ToolDef[]): Promise<ChatResult> {
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) throw new ChatProviderError('GEMINI_API_KEY ست نشده');
  const model = env('GEMINI_MODEL') || 'gemini-2.0-flash';
  const url = `${env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`;

  const declarations = tools.map((t) => ({
    name: t.name,
    description: t.description,
    ...(t.parameters.properties && Object.keys(t.parameters.properties).length ? { parameters: toGeminiSchema(t.parameters) } : {}),
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: geminiContents(turns),
      tools: [{ functionDeclarations: declarations }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ChatProviderError(`خطای Gemini (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] =
    data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('').trim();
  const calls: ToolCall[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({ id: `call_${i}`, name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  if (!text && calls.length === 0) throw new ChatProviderError('Gemini خروجی خالی برگردوند (شاید فیلتر ایمنی زده)');
  return { text, calls, raw: parts, provider: 'gemini', model, tokensUsed: data?.usageMetadata?.totalTokenCount ?? null };
}

/* --------------------------- Groq / OpenRouter (OpenAI) --------------------------- */

function openAiMessages(system: string, turns: Turn[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const t of turns) {
    if (t.role === 'user') out.push({ role: 'user', content: t.text });
    else if (t.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: t.text || null,
        ...(t.calls?.length
          ? {
              tool_calls: t.calls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of t.results) {
        out.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result) });
      }
    }
  }
  return out;
}

async function chatOpenAiCompatible(
  provider: 'groq' | 'openrouter',
  system: string,
  turns: Turn[],
  tools: ToolDef[],
  opts: { apiKeyEnv: string; baseUrlEnv: string; baseUrlDefault: string; modelEnv: string; modelDefault: string; extraHeaders?: Record<string, string> },
): Promise<ChatResult> {
  const apiKey = env(opts.apiKeyEnv);
  if (!apiKey) throw new ChatProviderError(`${opts.apiKeyEnv} ست نشده`);
  const model = env(opts.modelEnv) || opts.modelDefault;
  const url = `${env(opts.baseUrlEnv) || opts.baseUrlDefault}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...opts.extraHeaders },
    body: JSON.stringify({
      model,
      messages: openAiMessages(system, turns),
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ChatProviderError(`خطای ${provider} (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const text: string = (msg?.content ?? '').trim();
  const calls: ToolCall[] = (msg?.tool_calls ?? []).map(
    (c: { id?: string; function: { name: string; arguments?: string } }, i: number) => {
      let args: Record<string, unknown> = {};
      try {
        args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
      } catch {
        throw new ChatProviderError(`${provider}: آرگومان ابزار ${c.function.name} JSON معتبر نبود`);
      }
      return { id: c.id || `call_${i}`, name: c.function.name, args };
    },
  );
  if (!text && calls.length === 0) throw new ChatProviderError(`${provider} خروجی خالی برگردوند`);
  return { text, calls, provider, model, tokensUsed: data?.usage?.total_tokens ?? null };
}

const chatGroq = (s: string, t: Turn[], tools: ToolDef[]) =>
  chatOpenAiCompatible('groq', s, t, tools, {
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrlEnv: 'GROQ_BASE_URL',
    baseUrlDefault: 'https://api.groq.com/openai/v1',
    modelEnv: 'GROQ_MODEL',
    modelDefault: 'llama-3.3-70b-versatile',
  });

const chatOpenRouter = (s: string, t: Turn[], tools: ToolDef[]) =>
  chatOpenAiCompatible('openrouter', s, t, tools, {
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    baseUrlDefault: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_MODEL',
    modelDefault: 'meta-llama/llama-3.3-70b-instruct:free',
    extraHeaders: { 'X-Title': 'Shenskho Assistant' },
  });

const CALLS: Record<AiProvider, (s: string, t: Turn[], tools: ToolDef[]) => Promise<ChatResult>> = {
  gemini: chatGemini,
  groq: chatGroq,
  openrouter: chatOpenRouter,
};

/**
 * یک نوبت گفتگو با اولین ارائه‌دهنده‌ای که کلیدش ست شده و جواب داد.
 * اگر یکی خطا بده (سقف رایگان، خطای ابزار و…) خودکار سراغ بعدی می‌ره.
 */
export async function chatWithTools(system: string, turns: Turn[], tools: ToolDef[]): Promise<ChatResult> {
  const providers = configuredProviders();
  if (providers.length === 0) {
    throw new Error(
      'هیچ کلید API هوش مصنوعی‌ای ست نشده. یکی از GEMINI_API_KEY، GROQ_API_KEY یا OPENROUTER_API_KEY رو در .env.local بذار (راهنما در راهنمای-API-های-رایگان-AI.md).',
    );
  }
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await CALLS[p](system, turns, tools);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`همه‌ی ارائه‌دهنده‌های پیکربندی‌شده شکست خوردن:\n${errors.join('\n')}`);
}
