// Смоук-проверка расчёта КБЖУ по сохранённому рецепту. Запуск:
//   node --env-file=.env.local --import tsx scripts/nutrition-smoke.ts
//
// Проверяем главное: модель возвращает итог на ВСЁ блюдо (а не на порцию), и
// после нашего деления цифры выглядят правдоподобно. Для блинов ниже ожидаем
// примерно 1300–1800 ккал на всё, ~200 ккал на 100 г.

import { estimateNutrition } from '../lib/gemini/nutrition';
import { formatMacros, per100g, perServing, servingWeightG } from '../lib/recipe/nutrition';

const ctx = `Блины
Ингредиенты:
• Молоко — 500 мл
• Яйца — 2 шт.
• Мука — 200 г
• Сахар — 2 ст. л.
• Сливочное масло — 30 г
Приготовление:
1. Смешать яйца с молоком и сахаром, всыпать муку.
2. Жарить на сковороде с двух сторон.`;

async function main() {
  const res = await estimateNutrition(ctx, 4);
  if (!res.ok || !res.nutrition) {
    console.log('❌', res.error ?? 'модель не смогла посчитать');
    return;
  }
  const n = res.nutrition;
  console.log('на всё блюдо:', formatMacros(n.total), '| вес:', n.totalWeightG, 'г');
  const ps = perServing(n);
  console.log('на порцию:  ', ps ? formatMacros(ps) : '—', `(≈ ${servingWeightG(n) ?? '—'} г)`);
  const h = per100g(n);
  console.log('на 100 г:   ', h ? formatMacros(h) : '—');
  if (n.note) console.log('заметка:    ', n.note);
}
main().catch((e) => console.error(e));
