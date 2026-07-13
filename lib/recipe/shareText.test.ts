import { describe, it, expect } from 'vitest';
import { recipeToText } from './shareText';
import { normalizeRecipe, type StoredRecipe } from '../schema';

function make(): StoredRecipe {
  return normalizeRecipe({
    title: 'Борщ',
    intro: 'Наваристый',
    servings: 4,
    groups: [
      { name: null, items: [{ name: 'Свёкла', amount: '2 шт.' }] },
      { name: 'Для зажарки', items: [{ name: 'Морковь', amount: '100 г' }, { name: 'Соль', amount: 'по вкусу' }] },
    ],
    steps: [
      { label: 'Бульон', text: 'Сварить мясо', timerMinMinutes: 60, timerMaxMinutes: null, temperatureC: null, uses: [] },
      { label: null, text: 'Добавить овощи', timerMinMinutes: null, timerMaxMinutes: null, temperatureC: null, uses: [] },
    ],
    tips: ['Дай настояться'],
  });
}

describe('recipeToText', () => {
  it('содержит заголовок, интро, ингредиенты, шаги и советы', () => {
    const t = recipeToText(make());
    expect(t).toContain('Борщ');
    expect(t).toContain('Наваристый');
    expect(t).toContain('Ингредиенты:');
    expect(t).toContain('• Свёкла — 2 шт.');
    expect(t).toContain('Для зажарки:');
    expect(t).toContain('• Морковь — 100 г');
    expect(t).toContain('Приготовление:');
    expect(t).toContain('1. Бульон');
    expect(t).toContain('Сварить мясо');
    expect(t).toContain('2. Добавить овощи');
    expect(t).toContain('Советы:');
    expect(t).toContain('• Дай настояться');
  });

  it('масштабирует числовые количества, текстовые оставляет как есть', () => {
    const t = recipeToText(make(), 2);
    expect(t).toContain('• Свёкла — 4 шт.');
    expect(t).toContain('• Морковь — 200 г');
    expect(t).toContain('• Соль — по вкусу');
  });

  it('нумерует шаги подряд', () => {
    const t = recipeToText(make());
    expect(t.indexOf('1. Бульон')).toBeLessThan(t.indexOf('2. Добавить овощи'));
  });
});
