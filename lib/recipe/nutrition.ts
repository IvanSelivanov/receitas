// КБЖУ рецепта.
//
// Решение по форме данных (в духе scale.ts): у модели просим ОДИН набор чисел —
// итог на всё блюдо целиком + вес готового блюда. «На порцию» и «на 100 г»
// считаем сами делением. Причина: LLM плохо делит (особенно когда порций 3 или
// вес некруглый) и легко выдаёт три взаимно противоречивых набора цифр.
// Храним только оценку модели, производные считаем при рендере.

export interface Macros {
  kcal: number;
  protein: number; // г
  fat: number; // г
  carbs: number; // г
}

export interface StoredNutrition {
  /** КБЖУ на ВСЁ блюдо целиком, как его оценила модель. */
  total: Macros;
  /** Вес готового блюда, г (с учётом ужарки). null — модель не оценила. */
  totalWeightG: number | null;
  /** На сколько порций рассчитан рецепт на момент расчёта. */
  servings: number | null;
  /** Оговорки модели: «без учёта масла для жарки». */
  note: string | null;
  /** ISO-время расчёта. */
  computedAt: string;
}

// Сырая оценка от модели: любое поле может прийти null или мусором.
export interface RawNutrition {
  totalWeightG?: number | null;
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  note?: string | null;
}

// Разумный потолок: блюдо на 20 000 ккал — это уже не рецепт, а сбой модели.
// Отсекаем такие оценки, чтобы не показывать заведомую чушь.
const MAX_KCAL = 20000;
const MAX_WEIGHT_G = 50000;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/**
 * Проверяет сырую оценку и приводит к хранимой форме.
 * Возвращает null, если чисел нет или они невменяемые — тогда блок КБЖУ просто
 * не показывается (лучше ничего, чем выдуманные цифры).
 */
export function makeNutrition(
  raw: RawNutrition | null | undefined,
  servings: number | null,
  computedAt: string = new Date().toISOString(),
): StoredNutrition | null {
  if (!raw) return null;

  const kcal = num(raw.kcal);
  const protein = num(raw.protein);
  const fat = num(raw.fat);
  const carbs = num(raw.carbs);
  if (kcal == null || protein == null || fat == null || carbs == null) return null;
  if (kcal === 0 || kcal > MAX_KCAL) return null;

  const w = num(raw.totalWeightG);
  const totalWeightG = w != null && w > 0 && w <= MAX_WEIGHT_G ? w : null;

  const s = num(servings);

  return {
    total: { kcal, protein, fat, carbs },
    totalWeightG,
    servings: s != null && s > 0 ? s : null,
    note: raw.note?.trim() || null,
    computedAt,
  };
}

// Калории — целые, БЖУ — до 0.1 г. Дробные доли калории в оценке всё равно шум.
function round(m: Macros, k: number): Macros {
  const r1 = (v: number) => Math.round(v * k * 10) / 10;
  return {
    kcal: Math.round(m.kcal * k),
    protein: r1(m.protein),
    fat: r1(m.fat),
    carbs: r1(m.carbs),
  };
}

/** КБЖУ одной порции. null — если в рецепте не указано число порций. */
export function perServing(n: StoredNutrition): Macros | null {
  if (!n.servings || n.servings <= 0) return null;
  return round(n.total, 1 / n.servings);
}

/** КБЖУ на 100 г готового блюда. null — если модель не оценила вес. */
export function per100g(n: StoredNutrition): Macros | null {
  if (!n.totalWeightG || n.totalWeightG <= 0) return null;
  return round(n.total, 100 / n.totalWeightG);
}

/** Вес одной порции, г — для подписи «≈ 320 г». */
export function servingWeightG(n: StoredNutrition): number | null {
  if (!n.totalWeightG || !n.servings || n.servings <= 0) return null;
  return Math.round(n.totalWeightG / n.servings);
}

/** Строка «450 ккал · Б 22 · Ж 18 · У 45» для текстовых представлений. */
export function formatMacros(m: Macros): string {
  return `${m.kcal} ккал · Б ${m.protein} · Ж ${m.fat} · У ${m.carbs}`;
}
