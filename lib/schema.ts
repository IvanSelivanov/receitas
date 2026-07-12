import { z } from 'zod';
import { parseQuantity, type Quantity } from './recipe/scale';

// ───────────────────────────────────────────────────────────────────────────
// Схема ответа Gemini (structured output).
//
// Решения Eng Review:
//  - Один запрос = 1..N рецептов (2 из 3 реальных ответов многорецептовые).
//  - Количество приходит СЫРОЙ строкой ("5 ст. л.", "50–70 г", "по вкусу").
//    Мы парсим её сами детерминированным parseQuantity — не грузим этим LLM.
//  - Шаг ссылается на ингредиент по ИМЕНИ (uses[].ingredient). Резолвим имя->id
//    сами (best-effort). Несовпавшие ссылки не роняют рецепт.
// ───────────────────────────────────────────────────────────────────────────

export const GeminiIngredient = z.object({
  name: z.string().min(1),
  amount: z.string().default(''), // "5 ст. л." | "50–70 г" | "по вкусу" | ""
});

export const GeminiGroup = z.object({
  name: z.string().nullable().default(null), // "Для соуса" | null
  items: z.array(GeminiIngredient).default([]),
});

export const GeminiStepUse = z.object({
  ingredient: z.string().min(1), // имя ингредиента (резолвим в id)
  amount: z.string().nullable().default(null),
  note: z.string().nullable().default(null), // "оставшееся" | "половина" | ...
});

export const GeminiStep = z.object({
  label: z.string().nullable().default(null), // "Магия хруста"
  text: z.string().min(1),
  timerMinMinutes: z.number().nullable().default(null),
  timerMaxMinutes: z.number().nullable().default(null),
  temperatureC: z.number().nullable().default(null),
  uses: z.array(GeminiStepUse).default([]),
});

export const GeminiRecipe = z.object({
  title: z.string().min(1),
  intro: z.string().nullable().default(null),
  servings: z.number().nullable().default(null),
  groups: z.array(GeminiGroup).default([]),
  steps: z.array(GeminiStep).default([]),
  tips: z.array(z.string()).default([]),
});

export const GeminiResponse = z.object({
  recipes: z.array(GeminiRecipe).min(1),
});

export type TGeminiRecipe = z.infer<typeof GeminiRecipe>;

// Убирает markdown-обёртку ```json ... ``` вокруг ответа (иногда проскакивает
// даже при responseMimeType: application/json).
export function stripFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

// Приводит ответ к форме { recipes: [...] }. Модель непостоянна: возвращает то
// обёртку, то голый массив, то один рецепт объектом. Все три случая нормализуем.
export function normalizeEnvelope(json: unknown): unknown {
  if (Array.isArray(json)) return { recipes: json };
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.recipes)) return o;
    // Голый одиночный рецепт -> оборачиваем.
    if ('title' in o && ('steps' in o || 'groups' in o)) return { recipes: [o] };
  }
  return json;
}

// ───────────────────────────────────────────────────────────────────────────
// Нормализованная форма для хранения (jsonb) и рендера.
// ───────────────────────────────────────────────────────────────────────────

export interface StoredIngredient {
  id: string;
  name: string;
  quantity: Quantity; // разобранное количество (см. scale.ts)
}

export interface StoredGroup {
  name: string | null;
  items: StoredIngredient[];
}

export interface StoredStepUse {
  ref: string | null; // id ингредиента, либо null если имя не совпало (best-effort)
  ingredientName: string; // всегда сохраняем имя для отображения
  quantity: Quantity | null;
  note: string | null;
}

export interface StoredStep {
  label: string | null;
  text: string;
  timers: { minMin: number; maxMin: number }[];
  temperatureC: number | null;
  uses: StoredStepUse[];
  imageUrl?: string | null; // фото шага (добавляется после сохранения)
}

export interface StoredRecipe {
  title: string;
  intro: string | null;
  servings: number | null;
  groups: StoredGroup[];
  steps: StoredStep[];
  tips: string[];
}

function slugId(name: string, i: number): string {
  const base = name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base || 'ing'}-${i}`;
}

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Превращает ответ Gemini в хранимую форму:
 *  - присваивает стабильные id ингредиентам,
 *  - парсит сырые количества через parseQuantity,
 *  - резолвит uses[].ingredient (имя) -> id ингредиента (best-effort).
 *
 * Ссылки, чьё имя не совпало ни с одним ингредиентом, сохраняются с ref:null —
 * рецепт при этом не ломается (решение Eng Review: best-effort привязка).
 */
export function normalizeRecipe(r: TGeminiRecipe): StoredRecipe {
  const nameToId = new Map<string, string>();
  const idToQuantity = new Map<string, Quantity>();
  let idx = 0;

  const groups: StoredGroup[] = r.groups.map((g) => ({
    name: g.name,
    items: g.items.map((it) => {
      const id = slugId(it.name, idx++);
      nameToId.set(norm(it.name), id);
      const quantity = parseQuantity(it.amount);
      idToQuantity.set(id, quantity);
      return { id, name: it.name, quantity };
    }),
  }));

  // Фолбэк: если у шага нет количества, но ингредиент найден в мастер-списке —
  // подставляем количество оттуда. Работает и для многошаговых ингредиентов
  // (carry-forward: «потушили всю свёклу → добавили всю свёклу» = то же полное
  // количество, а не частичный остаток). Истинный расчёт остатка при реальном
  // делении требует конвертации единиц — это отдельная v2-задача.
  const steps: StoredStep[] = r.steps.map((s) => ({
    label: s.label,
    text: s.text,
    timers:
      s.timerMinMinutes != null
        ? [{ minMin: s.timerMinMinutes, maxMin: s.timerMaxMinutes ?? s.timerMinMinutes }]
        : [],
    temperatureC: s.temperatureC,
    uses: s.uses.map((u) => {
      const ref = nameToId.get(norm(u.ingredient)) ?? null;
      let quantity = u.amount ? parseQuantity(u.amount) : null;
      if (quantity == null && ref) {
        const master = idToQuantity.get(ref);
        if (master) quantity = master;
      }
      return { ref, ingredientName: u.ingredient, quantity, note: u.note };
    }),
  }));

  return { title: r.title, intro: r.intro, servings: r.servings, groups, steps, tips: r.tips };
}
