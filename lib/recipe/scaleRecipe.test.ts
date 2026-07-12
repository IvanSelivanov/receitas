import { describe, it, expect } from 'vitest';
import { scaleRecipe } from './scaleRecipe';
import { normalizeRecipe, type TGeminiRecipe } from '../schema';

const fixture: TGeminiRecipe = {
  title: 'Тест',
  intro: null,
  servings: 2,
  groups: [
    { name: null, items: [{ name: 'Мука', amount: '200 г' }, { name: 'Соль', amount: 'по вкусу' }] },
  ],
  steps: [
    {
      label: null,
      text: 'Смешай',
      timerMinMinutes: null,
      timerMaxMinutes: null,
      temperatureC: null,
      uses: [{ ingredient: 'Мука', amount: '200 г', note: null }],
    },
  ],
  tips: [],
};

describe('scaleRecipe', () => {
  const base = normalizeRecipe(fixture);

  it('x1 возвращает тот же объект', () => {
    expect(scaleRecipe(base, 1)).toBe(base);
  });

  it('x2 удваивает числовые количества в мастер-списке', () => {
    const r = scaleRecipe(base, 2);
    expect(r.groups[0].items[0].quantity).toMatchObject({ kind: 'number', value: 400 });
  });

  it('x2 не трогает "по вкусу"', () => {
    const r = scaleRecipe(base, 2);
    expect(r.groups[0].items[1].quantity).toMatchObject({ kind: 'text', raw: 'по вкусу' });
  });

  it('x0.5 масштабирует и количество в шаге', () => {
    const r = scaleRecipe(base, 0.5);
    expect(r.steps[0].uses[0].quantity).toMatchObject({ kind: 'number', value: 100 });
  });

  it('не мутирует исходный рецепт', () => {
    scaleRecipe(base, 2);
    expect(base.groups[0].items[0].quantity).toMatchObject({ value: 200 });
  });

  // Семантика редактируемых полей: правка ингредиента до N задаёт factor = N/исходное,
  // и остальные числовые количества масштабируются тем же factor.
  it('правка одного поля пересчитывает остальные пропорционально', () => {
    // Мука исходно 200 г. Хотим сделать 300 г -> factor = 300/200 = 1.5.
    const flourBase = base.groups[0].items[0].quantity as { value: number };
    const factor = 300 / flourBase.value;
    const r = scaleRecipe(base, factor);
    // Мука стала 300.
    expect(r.groups[0].items[0].quantity).toMatchObject({ value: 300 });
    // Количество в шаге (тоже 200 г муки) масштабировалось тем же factor -> 300.
    expect(r.steps[0].uses[0].quantity).toMatchObject({ value: 300 });
  });
});
