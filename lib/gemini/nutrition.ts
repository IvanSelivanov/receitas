import { GoogleGenAI } from '@google/genai';
import { MODEL, withRetry } from './client';
import { GeminiNutrition, stripFence } from '../schema';
import { makeNutrition, type StoredNutrition } from '../recipe/nutrition';

// Оценка КБЖУ для УЖЕ сохранённого рецепта (те, что созданы до появления этой
// фичи, а также после ручного редактирования состава). При генерации КБЖУ
// приходит сразу в общем JSON — отдельный вызов там не нужен.

// Общие правила расчёта. Один текст на оба сценария (генерация и пересчёт),
// чтобы цифры не разъезжались между ними.
export const NUTRITION_RULES = `Правила для nutrition (КБЖУ):
- Считай КБЖУ на ВСЁ блюдо целиком (сумма по всем ингредиентам), НЕ на порцию и НЕ на 100 г — деление сделаем сами.
- totalWeightG — примерный вес ГОТОВОГО блюда в граммах, с учётом ужарки/уварки и потери влаги (обычно меньше суммы сырых ингредиентов).
- Опирайся на стандартные справочные значения для продуктов; количества бери из ингредиентов.
- Ингредиенты без количества («по вкусу», «для жарки») оцени разумной типичной величиной либо не учитывай, а в note коротко скажи, что не учтено.
- Все числа — целые, без единиц измерения и без диапазонов.
- Если рассчитать невозможно (нет количеств вообще) — верни nutrition: null. Не выдумывай.`;

const SYSTEM = `Ты — нутрициолог. По рецепту оцени его пищевую ценность.
Верни СТРОГО JSON вида:
{ "totalWeightG": число, "kcal": число, "protein": число, "fat": число, "carbs": число, "note": "оговорка или null" }

${NUTRITION_RULES}
- Никакого текста вне JSON.`;

export interface NutritionResult {
  ok: boolean;
  nutrition?: StoredNutrition | null;
  error?: string;
}

export async function estimateNutrition(
  recipeContext: string,
  servings: number | null,
): Promise<NutritionResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: 'GEMINI_API_KEY не задан' };

  const ai = new GoogleGenAI({ apiKey: key });

  let text: string | undefined;
  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: recipeContext,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 512,
        },
      }),
    );
    text = res.text?.trim();
    if (!text) {
      const reason =
        res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? 'пусто';
      return { ok: false, error: `Модель не ответила (${reason}). Попробуй ещё раз.` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка вызова Gemini' };
  }

  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch {
    return { ok: false, error: 'Модель вернула невалидный JSON' };
  }

  // null — легальный ответ: «посчитать не по чему».
  if (json === null) return { ok: true, nutrition: null };

  const parsed = GeminiNutrition.safeParse(json);
  if (!parsed.success) {
    console.error('Nutrition zod issues:', parsed.error.issues.slice(0, 5));
    return { ok: false, error: 'Структура ответа не прошла валидацию' };
  }

  const nutrition = makeNutrition(parsed.data, servings);
  if (!nutrition) {
    return { ok: false, error: 'Не удалось оценить КБЖУ по этому рецепту — не хватает количеств.' };
  }
  return { ok: true, nutrition };
}
