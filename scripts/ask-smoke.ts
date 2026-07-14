import { askAboutRecipe } from '../lib/gemini/ask';

const ctx = `Блины
Ингредиенты:
• Молоко — 500 мл
• Яйца — 2 шт.
• Мука — 200 г
• Сливочное масло — 30 г
Приготовление:
1. Смешать яйца с молоком, всыпать муку.
2. Жарить на сковороде с двух сторон.`;

async function main() {
  const a = await askAboutRecipe(ctx, 'Чем заменить молоко, если его нет?');
  console.log('[замена]', a.ok ? a.answer : `ERR: ${a.error}`);

  // Уточняющий вопрос без явного упоминания молока — проверяем, что контекст диалога работает.
  const b = await askAboutRecipe(ctx, 'А сколько тогда брать, если возьму кефир?', [
    { q: 'Чем заменить молоко, если его нет?', a: a.answer ?? '' },
  ]);
  console.log('\n[уточнение]', b.ok ? b.answer : `ERR: ${b.error}`);
}
main().catch((e) => console.error(e));
