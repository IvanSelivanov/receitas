import { describe, it, expect } from 'vitest';
import { toEditGroups, buildEditedRecipe } from './edit';
import { normalizeRecipe, type TGeminiRecipe } from '../schema';

const base = normalizeRecipe({
  title: 'Утка',
  intro: null,
  servings: null,
  groups: [
    {
      name: 'Соус',
      items: [
        { name: 'Мёд', amount: '2 ст. л.' },
        { name: 'Горчица', amount: '1 ст. л.' },
      ],
    },
  ],
  steps: [
    {
      label: null,
      text: 'Смешай соус',
      timerMinMinutes: null,
      timerMaxMinutes: null,
      temperatureC: null,
      uses: [
        { ingredient: 'Мёд', amount: '2 ст. л.', note: null },
        { ingredient: 'Горчица', amount: '1 ст. л.', note: null },
      ],
    },
  ],
  tips: [],
} satisfies TGeminiRecipe);

describe('toEditGroups', () => {
  it('возвращает исходную строку количества для поля', () => {
    const eg = toEditGroups(base.groups);
    expect(eg[0].items[0]).toMatchObject({ name: 'Мёд', amount: '2 ст. л.' });
  });
});

describe('buildEditedRecipe', () => {
  it('добавление ингредиента в группу', () => {
    const eg = toEditGroups(base.groups);
    eg[0].items.push({ id: 'new-1', name: 'Белое вино', amount: '2 ст. л.' });
    const out = buildEditedRecipe(eg, base.steps);
    const names = out.groups[0].items.map((i) => i.name);
    expect(names).toContain('Белое вино');
    expect(out.groups[0].items.find((i) => i.name === 'Белое вино')!.quantity).toMatchObject({
      kind: 'number',
      value: 2,
      unit: 'ст. л.',
    });
  });

  it('правка количества обновляет и шаговое use', () => {
    const eg = toEditGroups(base.groups);
    eg[0].items[0].amount = '5 ст. л.'; // мёд 2 -> 5
    const out = buildEditedRecipe(eg, base.steps);
    expect(out.groups[0].items[0].quantity).toMatchObject({ value: 5 });
    const honeyUse = out.steps[0].uses.find((u) => u.ingredientName === 'Мёд')!;
    expect(honeyUse.quantity).toMatchObject({ value: 5 });
  });

  it('удаление ингредиента убирает и его ссылку из шага', () => {
    const eg = toEditGroups(base.groups);
    eg[0].items = eg[0].items.filter((i) => i.name !== 'Горчица');
    const out = buildEditedRecipe(eg, base.steps);
    expect(out.groups[0].items.map((i) => i.name)).toEqual(['Мёд']);
    expect(out.steps[0].uses.map((u) => u.ingredientName)).toEqual(['Мёд']);
  });

  it('пустые ингредиенты и шаги отбрасываются', () => {
    const eg = toEditGroups(base.groups);
    eg[0].items.push({ id: 'empty', name: '  ', amount: '' });
    const steps = [...base.steps, { label: null, text: '  ', timers: [], temperatureC: null, uses: [] }];
    const out = buildEditedRecipe(eg, steps);
    expect(out.groups[0].items).toHaveLength(2);
    expect(out.steps).toHaveLength(1);
  });
});
