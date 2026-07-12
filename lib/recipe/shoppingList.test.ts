import { describe, it, expect } from 'vitest';
import { buildShoppingList } from './shoppingList';
import { normalizeRecipe, type StoredRecipe } from '../schema';

function recipe(items: [string, string][]): StoredRecipe {
  return normalizeRecipe({
    title: 'r',
    intro: null,
    servings: null,
    groups: [{ name: null, items: items.map(([name, amount]) => ({ name, amount })) }],
    steps: [],
    tips: [],
  });
}

describe('buildShoppingList', () => {
  it('складывает одинаковый ингредиент с одинаковой единицей', () => {
    const list = buildShoppingList([recipe([['Мука', '200 г']]), recipe([['Мука', '300 г']])]);
    expect(list).toEqual([{ name: 'Мука', lines: ['500 г'] }]);
  });

  it('складывает штучные/ложки', () => {
    const list = buildShoppingList([
      recipe([['Соевый соус', '5 ст. л.']]),
      recipe([['Соевый соус', '2 ст. л.']]),
    ]);
    expect(list[0].lines).toEqual(['7 ст. л.']);
  });

  it('складывает диапазоны', () => {
    const list = buildShoppingList([
      recipe([['Масло', '50–70 г']]),
      recipe([['Масло', '50–70 г']]),
    ]);
    expect(list[0].lines).toEqual(['100–140 г']);
  });

  it('разные единицы одного ингредиента — отдельными строками', () => {
    const list = buildShoppingList([
      recipe([['Молоко', '200 мл']]),
      recipe([['Молоко', '1 стакан']]),
    ]);
    expect(list[0].name).toBe('Молоко');
    expect(list[0].lines).toHaveLength(2);
    expect(list[0].lines).toEqual(expect.arrayContaining(['200 мл', '1 стакан']));
  });

  it('нечисловое количество не суммируется, дедуплицируется', () => {
    const list = buildShoppingList([
      recipe([['Соль', 'по вкусу']]),
      recipe([['Соль', 'по вкусу']]),
    ]);
    expect(list).toEqual([{ name: 'Соль', lines: ['по вкусу'] }]);
  });

  it('имя без учёта регистра сливается в один пункт', () => {
    const list = buildShoppingList([recipe([['Лук', '1 шт.']]), recipe([['лук', '2 шт.']])]);
    expect(list).toHaveLength(1);
    expect(list[0].lines).toEqual(['3 шт.']);
  });

  it('сортирует по алфавиту', () => {
    const list = buildShoppingList([recipe([['Яйцо', '2 шт.'], ['Мука', '100 г'], ['Соль', 'по вкусу']])]);
    expect(list.map((i) => i.name)).toEqual(['Мука', 'Соль', 'Яйцо']);
  });

  it('пустой ввод -> пустой список', () => {
    expect(buildShoppingList([])).toEqual([]);
  });
});
