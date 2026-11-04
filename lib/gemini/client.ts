import {
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GoogleGenAI,
  type ThinkingConfig,
} from '@google/genai';

// Общее для всех вызовов Gemini: список моделей и фолбэк между ними.
//
// Основная — Flash Lite 3.1: 500 запросов/сутки на бесплатном тарифе, быстрая.
// Но в пики она отвечает 503 «high demand». Тогда сразу (без паузы) идём в
// следующую модель списка — у неё своя мощность и своя квота.
const PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash-lite')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const MODELS = [...new Set([PRIMARY, ...FALLBACKS])];

// Сколько раз проходим по всему списку моделей, если все заняты.
const ROUNDS = 2;

// Размышления выключаем во всех вызовах: они плавают по длине и съедают бюджет
// вывода (из-за этого обрезался JSON). Gemini 3.5+ не принимает
// thinkingBudget: 0 (400 INVALID_ARGUMENT), у неё вместо этого уровень.
export function noThinking(model: string): ThinkingConfig {
  return /^gemini-(3\.[5-9]|[4-9])/.test(model)
    ? { thinkingLevel: ThinkingLevel.MINIMAL }
    : { thinkingBudget: 0 };
}

function errStatus(e: unknown): number | undefined {
  const s = (e as { status?: unknown })?.status;
  return typeof s === 'number' ? s : undefined;
}

// Временные ошибки: перегрузка (503), квота модели (429), сбои сервера (500/504).
// На них есть смысл идти в другую модель. 400/401/404 — постоянные, пробрасываем.
function isTransient(e: unknown): boolean {
  const status = errStatus(e);
  if (status !== undefined) return [429, 500, 503, 504].includes(status);
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded)\b/i.test(msg);
}

export interface GeminiCall {
  res: GenerateContentResponse;
  /** Модель, которая в итоге ответила. */
  model: string;
}

// generateContent с фолбэком по MODELS. thinkingConfig подставляется сам —
// под конкретную модель (см. noThinking).
export async function generateWithFallback(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>,
): Promise<GeminiCall> {
  let lastErr: unknown;
  for (let round = 0; round < ROUNDS; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 1000));
    for (const model of MODELS) {
      try {
        const res = await ai.models.generateContent({
          ...params,
          model,
          config: { ...params.config, thinkingConfig: noThinking(model) },
        });
        if (model !== PRIMARY) console.warn(`Gemini: ответила запасная модель ${model}`);
        return { res, model };
      } catch (e) {
        if (!isTransient(e)) throw e;
        lastErr = e;
        console.warn(`Gemini ${model}: ${errStatus(e) ?? 'transient'}, пробуем следующую`);
      }
    }
  }
  // Все модели заняты — понятное сообщение вместо сырого JSON ошибки API.
  const quota = errStatus(lastErr) === 429;
  throw new Error(
    quota
      ? 'Исчерпан лимит запросов Gemini. Попробуй позже.'
      : 'Gemini сейчас перегружен. Попробуй через минуту.',
    { cause: lastErr },
  );
}
