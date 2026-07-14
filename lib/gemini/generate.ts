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
- Если приложен файл с рецептом (скриншот, скан, PDF, текст, фото страницы книги) — извлеки рецепт(ы) точно, ничего не добавляя от себя.
- Если на фото готовое блюдо или набор продуктов (без текста рецепта) — определи, что это за блюдо, и предложи подходящий рецепт, как его приготовить. Реконструировать рецепт по виду блюда здесь нормально и ожидаемо.
- Если в запросе есть ссылка (URL) — открой её и пересказывай рецепт именно с этой страницы, ничего не выдумывай.
- Если ССЫЛКУ открыть не удалось — верни recipes: [] (пустой массив) и не выдумывай рецепт. Это касается ТОЛЬКО ссылок; для фото блюда рецепт предлагай всегда.
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

// Сообщение, когда модель не смогла ничего вернуть по источнику. Текст зависит
// от того, что за источник: у ссылки и у фото причины (и советы) разные.
function sourceFail(media: Media | undefined, hasUrl: boolean): string {
  if (media?.mimeType.startsWith('image/')) {
    return 'Не удалось разобрать блюдо на фото. Попробуй снимок почётче или подскажи текстом, что это за блюдо.';
  }
  if (media) {
    return 'Не удалось извлечь рецепт из файла. Попробуй другой файл или вставь текст рецепта.';
  }
  if (hasUrl) {
    return 'Не удалось открыть ссылку. Instagram/TikTok блокируют доступ — вставь текст описания или загрузи скриншот/фото.';
  }
  return 'Не удалось составить рецепт по запросу. Уточни, что именно приготовить.';
}

export async function generateRecipes(userPrompt: string, media?: Media): Promise<GenerateResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, recipes: [], error: 'GEMINI_API_KEY не задан' };

  const ai = new GoogleGenAI({ apiKey: key });

  // С файлом — мультимодальный запрос (картинка/PDF + текст), иначе просто текст.
  const contents = media
    ? createUserContent([createPartFromBase64(media.dataB64, media.mimeType), userPrompt])
    : userPrompt;

  // urlContext включаем ТОЛЬКО при наличии ссылки в запросе. Иначе тул иногда
  // сам тянет контент (десятки тысяч токенов) и модель отдаёт пустой ответ.
  const hasUrl = /https?:\/\/\S+/i.test(userPrompt);

  let text: string | undefined;
  let finishReason: string | undefined;
  let blockReason: string | undefined;
  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: 'application/json',
          // URL context — только когда в запросе есть ссылка (см. hasUrl выше).
          ...(hasUrl ? { tools: [{ urlContext: {} }] } : {}),
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
    blockReason = res.promptFeedback?.blockReason;
    if (!text) {
      console.error('Gemini empty response:', {
        model: MODEL,
        finishReason,
        blockReason,
        candidates: res.candidates?.length,
        usage: res.usageMetadata,
      });
    }
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

  if (!text) {
    const reason = blockReason
      ? `заблокировано: ${blockReason}`
      : finishReason
        ? `finishReason: ${finishReason}`
        : 'причина неизвестна';
    return { ok: false, recipes: [], error: `Модель вернула пустой ответ (${reason})` };
  }

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
    return { ok: false, recipes: [], error: sourceFail(media, hasUrl) };
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
    return { ok: false, recipes: [], error: sourceFail(media, hasUrl) };
  }

  return { ok: true, recipes };
}
