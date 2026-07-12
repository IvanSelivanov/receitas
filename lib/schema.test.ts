import { describe, it, expect } from 'vitest';
import {
  GeminiResponse,
  normalizeRecipe,
  stripFence,
  normalizeEnvelope,
  type TGeminiRecipe,
} from './schema';

// Фикстура по мотивам examples/asian_chicken: группы ингредиентов + шаг,
// ссылающийся на ингредиент по имени.
const asianChicken: TGeminiRecipe = {
  title: 'Азиатские бёдра в карамели',
  intro: 'Хит гастробара.',
  servings: null,
  groups: [
    { name: null, items: [{ name: 'Куриные бёдра', amount: '6-8 шт.' }, { name: 'Крахмал', amount: '3-4 ст. л.' }] },
    { name: 'Для соуса', items: [{ name: 'Соевый соус', amount: '5 ст. л.' }, { name: 'Мёд', amount: '2 ст. л.' }] },
  ],
  steps: [
    {
      label: 'Делаем соус',
      text: 'Влей соевый соус и мёд, помешивай.',
      timerMinMinutes: 2,
      timerMaxMinutes: null,
      temperatureC: null,
      uses: [
        { ingredient: 'Соевый соус', amount: '5 ст. л.', note: null },
        { ingredient: 'Мёд', amount: '2 ст. л.', note: null },
        { ingredient: 'Несуществующий', amount: '1 шт.', note: null }, // проверка best-effort
      ],
    },
  ],
  tips: ['Кушай палочками'],
};

describe('GeminiResponse schema', () => {
  it('принимает многорецептовый ответ', () => {
    const parsed = GeminiResponse.safeParse({ recipes: [asianChicken, asianChicken] });
    expect(parsed.success).toBe(true);
  });

  it('отклоняет пустой список рецептов', () => {
    expect(GeminiResponse.safeParse({ recipes: [] }).success).toBe(false);
  });

  it('проставляет дефолты для отсутствующих полей', () => {
    const parsed = GeminiResponse.safeParse({ recipes: [{ title: 'Тост', steps: [{ text: 'Поджарь' }] }] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipes[0].groups).toEqual([]);
      expect(parsed.data.recipes[0].tips).toEqual([]);
    }
  });
});

describe('stripFence', () => {
  it('снимает ```json ... ``` обёртку', () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('снимает ``` без языка', () => {
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('оставляет чистый JSON как есть', () => {
    expect(stripFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe('normalizeEnvelope (терпимость к обёртке модели)', () => {
  const single = { title: 'Тост', steps: [{ text: 'Поджарь' }] };

  it('уже обёрнутый {recipes:[...]} проходит', () => {
    const j = { recipes: [single] };
    expect(GeminiResponse.safeParse(normalizeEnvelope(j)).success).toBe(true);
  });

  it('голый массив рецептов -> оборачивает', () => {
    const j = [single, single];
    const env = normalizeEnvelope(j);
    expect(env).toMatchObject({ recipes: [single, single] });
    expect(GeminiResponse.safeParse(env).success).toBe(true);
  });

  it('одиночный голый рецепт (title+steps) -> оборачивает', () => {
    const env = normalizeEnvelope(single);
    expect(env).toMatchObject({ recipes: [single] });
    expect(GeminiResponse.safeParse(env).success).toBe(true);
  });

  it('одиночный голый рецепт с groups тоже оборачивается', () => {
    const withGroups = { title: 'X', groups: [{ items: [{ name: 'Соль', amount: 'по вкусу' }] }] };
    expect(GeminiResponse.safeParse(normalizeEnvelope(withGroups)).success).toBe(true);
  });

  it('невнятный объект не оборачивается (упадёт валидация — ожидаемо)', () => {
    const junk = { foo: 'bar' };
    expect(GeminiResponse.safeParse(normalizeEnvelope(junk)).success).toBe(false);
  });
});

describe('normalizeRecipe', () => {
  const r = normalizeRecipe(asianChicken);

  it('присваивает уникальные id ингредиентам', () => {
    const ids = r.groups.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(4);
  });

  it('парсит количества (диапазон и число)', () => {
    expect(r.groups[0].items[0].quantity).toMatchObject({ kind: 'range', min: 6, max: 8, unit: 'шт.' });
    expect(r.groups[1].items[0].quantity).toMatchObject({ kind: 'number', value: 5, unit: 'ст. л.' });
  });

  it('резолвит uses по имени в id ингредиента', () => {
    const soy = r.steps[0].uses.find((u) => u.ingredientName === 'Соевый соус')!;
    const soyIngredient = r.groups[1].items[0];
    expect(soy.ref).toBe(soyIngredient.id);
  });

  it('best-effort: несовпавшее имя -> ref:null, рецепт не ломается', () => {
    const ghost = r.steps[0].uses.find((u) => u.ingredientName === 'Несуществующий')!;
    expect(ghost.ref).toBeNull();
    expect(ghost.ingredientName).toBe('Несуществующий'); // имя всё равно для отображения
  });

  it('распознаёт таймер шага', () => {
    expect(r.steps[0].timers).toEqual([{ minMin: 2, maxMin: 2 }]);
  });
});

describe('normalizeRecipe: фолбэк количества на шаге из мастер-списка', () => {
  const fixture: TGeminiRecipe = {
    title: 'X',
    intro: null,
    servings: null,
    groups: [
      {
        name: null,
        items: [
          { name: 'Лук', amount: '1 шт.' }, // используется в одном шаге
          { name: 'Масло', amount: '2 ст. л.' }, // используется в двух шагах
        ],
      },
    ],
    steps: [
      {
        label: null, text: 'шаг1', timerMinMinutes: null, timerMaxMinutes: null, temperatureC: null,
        uses: [
          { ingredient: 'Лук', amount: null, note: null },
          { ingredient: 'Масло', amount: null, note: null }, // тушим масло
        ],
      },
      {
        label: null, text: 'шаг2', timerMinMinutes: null, timerMaxMinutes: null, temperatureC: null,
        uses: [{ ingredient: 'Масло', amount: null, note: 'оставшееся' }], // добавляем то же масло
      },
    ],
    tips: [],
  };
  const r = normalizeRecipe(fixture);

  it('однозначный ингредиент (1 шаг) без amount -> берёт количество из мастера', () => {
    const luk = r.steps[0].uses.find((u) => u.ingredientName === 'Лук')!;
    expect(luk.quantity).toMatchObject({ kind: 'number', value: 1, unit: 'шт.' });
  });

  it('многошаговый ингредиент (carry-forward) -> тоже берёт количество из мастера', () => {
    const maslo0 = r.steps[0].uses.find((u) => u.ingredientName === 'Масло')!;
    const maslo1 = r.steps[1].uses.find((u) => u.ingredientName === 'Масло')!;
    expect(maslo0.quantity).toMatchObject({ kind: 'number', value: 2, unit: 'ст. л.' });
    expect(maslo1.quantity).toMatchObject({ kind: 'number', value: 2, unit: 'ст. л.' });
  });

  it('use с note "оставшееся" без amount -> показываем количество из мастера, не слово', () => {
    const maslo1 = r.steps[1].uses.find((u) => u.ingredientName === 'Масло')!;
    // quantity заполнен -> в UI покажется "2 ст. л.", а не note "оставшееся"
    expect(maslo1.quantity).not.toBeNull();
  });
});
