// Общее для всех вызовов Gemini: имя модели и ретрай на временные ошибки.
//
// Flash Lite: 500 запросов/сутки на бесплатном тарифе (против 20 у 3.5-flash),
// быстрее и дешевле. Для генерации и Q&A по рецепту качества lite хватает.
export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Ретрай на временные ошибки Gemini (503 UNAVAILABLE / 429). Экспоненциальный
// бэкофф. Постоянные ошибки (401 ключ, 400 запрос) пробрасываем сразу.
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const transient = /\b(503|429|UNAVAILABLE|high demand|overloaded)\b/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i)); // 0.8s, 1.6s
    }
  }
  throw lastErr;
}
