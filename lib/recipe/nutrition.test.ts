import { describe, it, expect } from 'vitest';
import {
  makeNutrition,
  per100g,
  perServing,
  servingWeightG,
  formatMacros,
  type StoredNutrition,
} from './nutrition';

const AT = '2026-08-11T10:00:00.000Z';

// Блюдо: 2400 ккал / Б90 / Ж120 / У210, вес 1200 г, 4 порции.
function make(over: Partial<Parameters<typeof makeNutrition>[0]> = {}, servings: number | null = 4) {
  return makeNutrition(
    { totalWeightG: 1200, kcal: 2400, protein: 90, fat: 120, carbs: 210, note: null, ...over },
    servings,
    AT,
  ) as StoredNutrition;
}

describe('makeNutrition', () => {
  it('сохраняет оценку как есть + число порций и время расчёта', () => {
    expect(make()).toEqual({
      total: { kcal: 2400, protein: 90, fat: 120, carbs: 210 },
      totalWeightG: 1200,
      servings: 4,
      note: null,
      computedAt: AT,
    });
  });

  it('нет чисел -> null (лучше не показывать блок, чем выдумывать)', () => {
    expect(makeNutrition(null, 4)).toBeNull();
    expect(makeNutrition({ kcal: 500, protein: null, fat: 10, carbs: 20 }, 4)).toBeNull();
    expect(makeNutrition({ kcal: 0, protein: 0, fat: 0, carbs: 0 }, 4)).toBeNull();
  });

  it('невменяемые числа отсекаются', () => {
    expect(makeNutrition({ kcal: 999999, protein: 1, fat: 1, carbs: 1 }, 4)).toBeNull();
    expect(makeNutrition({ kcal: -100, protein: 1, fat: 1, carbs: 1 }, 4)).toBeNull();
    expect(makeNutrition({ kcal: NaN, protein: 1, fat: 1, carbs: 1 }, 4)).toBeNull();
  });

  it('битый вес -> totalWeightG null, но оценка остаётся', () => {
    expect(make({ totalWeightG: 0 }).totalWeightG).toBeNull();
    expect(make({ totalWeightG: null }).totalWeightG).toBeNull();
    expect(make({ totalWeightG: -5 }).total.kcal).toBe(2400);
  });

  it('порции 0 или null -> servings null', () => {
    expect(make({}, 0).servings).toBeNull();
    expect(make({}, null).servings).toBeNull();
  });

  it('пустая заметка нормализуется в null', () => {
    expect(make({ note: '   ' }).note).toBeNull();
    expect(make({ note: 'без масла для жарки' }).note).toBe('без масла для жарки');
  });
});

describe('perServing', () => {
  it('делит на число порций', () => {
    expect(perServing(make())).toEqual({ kcal: 600, protein: 22.5, fat: 30, carbs: 52.5 });
  });

  it('округляет: ккал до целых, БЖУ до 0.1', () => {
    const n = make({ kcal: 1000, protein: 33, fat: 10, carbs: 20 }, 3);
    expect(perServing(n)).toEqual({ kcal: 333, protein: 11, fat: 3.3, carbs: 6.7 });
  });

  it('без числа порций -> null', () => {
    expect(perServing(make({}, null))).toBeNull();
  });
});

describe('per100g', () => {
  it('пересчитывает на 100 г готового блюда', () => {
    expect(per100g(make())).toEqual({ kcal: 200, protein: 7.5, fat: 10, carbs: 17.5 });
  });

  it('без веса -> null', () => {
    expect(per100g(make({ totalWeightG: null }))).toBeNull();
  });

  it('не зависит от числа порций', () => {
    expect(per100g(make({}, 2))).toEqual(per100g(make({}, 8)));
  });
});

describe('servingWeightG', () => {
  it('вес порции = вес блюда / порции', () => {
    expect(servingWeightG(make())).toBe(300);
  });

  it('без веса или без порций -> null', () => {
    expect(servingWeightG(make({ totalWeightG: null }))).toBeNull();
    expect(servingWeightG(make({}, null))).toBeNull();
  });
});

describe('formatMacros', () => {
  it('человекочитаемая строка', () => {
    expect(formatMacros({ kcal: 600, protein: 22.5, fat: 30, carbs: 52.5 })).toBe(
      '600 ккал · Б 22.5 · Ж 30 · У 52.5',
    );
  });
});
