import { GoogleGenAI } from '@google/genai';
import { MODEL, withRetry } from './client';

// Вопрос-ответ по конкретному рецепту: замены ингредиентов, уточнения по технике,
// таймингу, температуре. В отличие от генерации — обычный текстовый ответ (без
// JSON): его показываем как есть.

const SYSTEM = `Ты — кулинарный помощник. Пользователь спрашивает по конкретному рецепту (он дан ниже).
Отвечай кратко, по делу и на русском. Опирайся на рецепт, но можно использовать общие
кулинарные знания: предлагать замены ингредиентов, объяснять технику, температуру, тайминг,
пропорции. Если замена заметно влияет на вкус или текстуру — предупреди об этом.
Не выдумывай того, чего не знаешь. Если вопрос вообще не про этот рецепт или не про готовку —
вежливо скажи, что помогаешь только с этим рецептом.`;

export interface AskResult {
  ok: boolean;
  answer?: string;
  error?: string;
}

export async function askAboutRecipe(recipeContext: string, question: string): Promise<AskResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: 'GEMINI_API_KEY не задан' };

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `Рецепт:\n${recipeContext}\n\nВопрос: ${question}`;

  try {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 1024,
        },
      }),
    );
    const text = res.text?.trim();
    if (!text) {
      const reason =
        res.promptFeedback?.blockReason ?? res.candidates?.[0]?.finishReason ?? 'пусто';
      return { ok: false, error: `Модель не ответила (${reason}). Попробуй переформулировать.` };
    }
    return { ok: true, answer: text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка вызова Gemini' };
  }
}
