// Количество ингредиента и его масштабирование.
//
// Решение Eng Review (2026-07-11): единица — непрозрачная строка, множитель
// умножает ТОЛЬКО число. Никакой конвертации единиц (ст.л.↔г зависит от
// плотности продукта — яма). "по вкусу"/"для жарки"/"горсть" не масштабируются.
//
//   parseQuantity("50–70 г")  ->  { kind: 'range', min: 50, max: 70, unit: 'г' }
//   scaleQuantity(q, 2)       ->  { kind: 'range', min: 100, max: 140, unit: 'г' }
//   formatQuantity(...)       ->  "100–140 г"
//
//   parseQuantity("по вкусу") ->  { kind: 'text', raw: 'по вкусу' }
//   scaleQuantity(text, 2)    ->  без изменений

export type Quantity =
  | { kind: 'number'; value: number; unit: string | null; raw: string }
  | { kind: 'range'; min: number; max: number; unit: string | null; raw: string }
  | { kind: 'text'; raw: string };

// Русские рецепты пишут дробные через запятую ("1,5 ст. л."). Нормализуем.
function toNum(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

// Округляем до 2 знаков и убираем хвостовые нули: 0.5, 2, 1.33.
function roundNice(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtNum(n: number): string {
  return String(roundNice(n));
}

const RANGE_RE = /^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*(.*)$/;
const FRACTION_RE = /^(\d+)\s*\/\s*(\d+)\s*(.*)$/;
const SINGLE_RE = /^(\d+(?:[.,]\d+)?)\s*(.*)$/;

/**
 * Разбирает сырую строку количества в структуру.
 * Нечисловые формы ("по вкусу", "для жарки", "щепотка") -> kind:'text'.
 */
export function parseQuantity(raw: string): Quantity {
  const s = raw.trim();
  if (!s) return { kind: 'text', raw };

  const range = s.match(RANGE_RE);
  if (range) {
    return {
      kind: 'range',
      min: toNum(range[1]),
      max: toNum(range[2]),
      unit: range[3].trim() || null,
      raw,
    };
  }

  const frac = s.match(FRACTION_RE);
  if (frac) {
    const denom = toNum(frac[2]);
    // Дробь распознана явно — не проваливаемся в одиночное число.
    // Деление на ноль -> малформед -> text (не "1 чего-то").
    if (denom === 0) return { kind: 'text', raw };
    return { kind: 'number', value: toNum(frac[1]) / denom, unit: frac[3].trim() || null, raw };
  }

  const single = s.match(SINGLE_RE);
  if (single) {
    return { kind: 'number', value: toNum(single[1]), unit: single[2].trim() || null, raw };
  }

  return { kind: 'text', raw };
}

/** Умножает числовые количества на factor. Текстовые — без изменений. */
export function scaleQuantity(q: Quantity, factor: number): Quantity {
  switch (q.kind) {
    case 'number':
      return { ...q, value: roundNice(q.value * factor), raw: formatQuantity({ ...q, value: q.value * factor }) };
    case 'range':
      return {
        ...q,
        min: roundNice(q.min * factor),
        max: roundNice(q.max * factor),
        raw: formatQuantity({ ...q, min: q.min * factor, max: q.max * factor }),
      };
    case 'text':
      return q;
  }
}

/** Человекочитаемая строка количества. */
export function formatQuantity(q: Quantity): string {
  switch (q.kind) {
    case 'number':
      return q.unit ? `${fmtNum(q.value)} ${q.unit}` : fmtNum(q.value);
    case 'range': {
      const body = `${fmtNum(q.min)}–${fmtNum(q.max)}`;
      return q.unit ? `${body} ${q.unit}` : body;
    }
    case 'text':
      return q.raw;
  }
}
