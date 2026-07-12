// Проверка детекта нечитаемого источника + отсутствия регрессии.
//   node --env-file=.env.local --import tsx scripts/diag.ts
import { generateRecipes } from '../lib/gemini/generate';

async function main() {
  const ig = await generateRecipes(
    'можешь пересказать рецепт салата из инстаграм рилса? https://www.instagram.com/reel/DQaI3NTgAuI/',
  );
  console.log(
    `[Instagram] ok=${ig.ok}`,
    ig.ok ? `(⚠ ожидали ошибку!) рецептов ${ig.recipes.length}` : `-> "${ig.error}"`,
  );

  const normal = await generateRecipes('Простой рецепт омлета');
  console.log(
    `[обычный] ok=${normal.ok}`,
    normal.ok ? `-> "${normal.recipes[0].title}"` : `(⚠ регрессия) ${normal.error}`,
  );
}
main().catch((e) => console.error(e));
