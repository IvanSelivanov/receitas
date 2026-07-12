import { GoogleGenAI, createUserContent, createPartFromBase64 } from '@google/genai';
import { GeminiResponse, normalizeRecipe, stripFence, normalizeEnvelope, type StoredRecipe } from '../schema';

// Приложенный файл (картинка или PDF) в base64.
export interface Media {
  mimeType: string;
  dataB64: string;
}

// Вызов Gemini с JSON-выводом. Ключ живёт ТОЛЬКО на сервере (env), в браузер
// не попадает. Вызывать исключительно из серверного кода (route handler).
//
// SDK: @google/genai (новый). Метод: ai.models.generateContent(...).
// Решение Eng Review: structured output + zod-валидация + фолбэк на сырой текст
// при невалидном JSON. Рецептов может быть 1..N.

// Flash Lite: 500 запросов/сутки на бесплатном тарифе (против 20 у 3.5-flash),
// быстрее и дешевле. Генерации рецепта со структурой качества lite хватает.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const SYSTEM = `Ты — помощник по рецептам. По запросу пользователя предложи один или несколько рецептов.
Верни СТРОГО JSON вида:
{
  "recipes": [
    {
      "title": "название",
      "intro": "короткое вступление или null",
      "servings": число_порций_или_null,
      "groups": [
        { "name": "Для соуса" или null, "items": [ { "name": "Соевый соус", "amount": "5 ст. л." } ] }
      ],
      "steps": [
        {
          "label": "короткий заголовок шага или null",
          "text": "что делать",
          "timerMinMinutes": число_или_null,
          "timerMaxMinutes": число_или_null,
          "temperatureC": число_или_null,
          "uses": [ { "ingredient": "точное имя ингредиента из groups", "amount": "5 ст. л." или null, "note": "оставшееся" или null } ]
        }
      ],
      "tips": ["общие советы"]
    }
  ]
}
Правила:
- Если приложен файл (фото, скриншот, скан, PDF, текст) — извлеки рецепт(ы) из него, ничего не выдумывая.
- Если в запросе есть ссылка (URL) — открой её и пересказывай рецепт именно с этой страницы, ничего не выдумывай.
- Если источник (ссылку или файл) прочитать не удалось — верни recipes: [] (пустой массив), НЕ выдумывай рецепт и НЕ создавай заглушку.
- amount оставляй как в рецепте ("50–70 г", "по вкусу", "2 зубчика") — НЕ переводи единицы.
- В uses[].ingredient пиши ИМЯ ровно так, как в groups, чтобы можно было сматчить.
- Для КАЖДОГО ингредиента в uses указывай amount — количество, идущее на этом шаге (по умолчанию столько же, сколько в groups). Не оставляй amount пустым без причины; если ингредиент уже частично ушёл в прошлом шаге — ставь note "оставшееся".
- Если у шага есть время готовки — заполни timerMinMinutes (и timerMaxMinutes для диапазона).
- Никакого текста вне JSON.`;

// Ретрай на временные ошибки Gemini (503 UNAVAILABLE / 429). Экспоненциальный
// бэкофф. Постоянные ошибки (401 ключ, 400 запрос) пробрасываем сразу.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
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

export interface GenerateResult {
  ok: boolean;
  recipes: StoredRecipe[];
  /** Сырой текст модели — показываем пользователю, если JSON не распарсился. */
  raw?: string;
  error?: string;
}

const SOURCE_FAIL =
  'Не удалось извлечь рецепт из источника. Instagram/TikTok блокируют доступ по ссылке — ' +
  'вставь текст описания или загрузи скриншот/файл.';

export async function generateRecipes(userPrompt: string, media?: Media): Promise<GenerateResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, recipes: [], error: 'GEMINI_API_KEY не задан' };

  const ai = new GoogleGenAI({ apiKey: key });

  // С файлом — мультимодальный запрос (картинка/PDF + текст), иначе просто текст.
  const contents = media
    ? createUserContent([createPartFromBase64(media.dataB64, media.mimeType), userPrompt])
    : userPrompt;

  let text: string | undefined;
  let finishReason: string | undefined;
  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: 'application/json',
          // URL context: даёт модели читать ссылки из запроса (иначе она их не
          // видит и выдумывает рецепт). Бездействует, когда ссылки нет.
          tools: [{ urlContext: {} }],
          // Размышления (thinking) плавают по длине и съедают бюджет вывода —
          // это причина случайной обрезки JSON. Для структурной генерации они
          // не нужны: выключаем и отдаём весь бюджет ответу.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
        },
      }),
    );
    text = res.text;
    finishReason = res.candidates?.[0]?.finishReason;
  } catch (e) {
    return { ok: false, recipes: [], error: e instanceof Error ? e.message : 'Ошибка вызова Gemini' };
  }

  // Обрезка по лимиту токенов -> внятная причина вместо «невалидный JSON».
  if (finishReason === 'MAX_TOKENS') {
    return {
      ok: false,
      recipes: [],
      raw: text,
      error: 'Ответ не поместился в лимит — попробуй запрос короче или на меньшее число рецептов',
    };
  }

  if (!text) return { ok: false, recipes: [], error: 'Модель вернула пустой ответ' };

  // Фолбэк: если JSON битый — отдаём сырой текст, приложение не падает.
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch {
    return { ok: false, recipes: [], raw: text, error: 'Модель вернула невалидный JSON' };
  }

  // Нормализуем обёртку (массив / голый объект / {recipes}) перед валидацией.
  const enveloped = normalizeEnvelope(json);

  // Модель вернула пустой список -> источник не прочитан (Instagram, кривое фото).
  if (
    enveloped &&
    typeof enveloped === 'object' &&
    Array.isArray((enveloped as { recipes?: unknown }).recipes) &&
    (enveloped as { recipes: unknown[] }).recipes.length === 0
  ) {
    return { ok: false, recipes: [], error: SOURCE_FAIL };
  }

  const parsed = GeminiResponse.safeParse(enveloped);
  if (!parsed.success) {
    console.error('Gemini zod issues:', parsed.error.issues.slice(0, 5));
    return { ok: false, recipes: [], raw: text, error: 'Структура ответа не прошла валидацию' };
  }

  const recipes = parsed.data.recipes.map(normalizeRecipe);

  // Рецепты есть, но все пустые (нет ни ингредиентов, ни шагов) -> заглушка.
  const allEmpty = recipes.every(
    (r) => r.steps.length === 0 && r.groups.every((g) => g.items.length === 0),
  );
  if (allEmpty) {
    return { ok: false, recipes: [], error: SOURCE_FAIL };
  }

  return { ok: true, recipes };
}
