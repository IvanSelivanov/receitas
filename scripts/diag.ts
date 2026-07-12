import { generateRecipes } from '../lib/gemini/generate';

async function main() {
  const r = await generateRecipes('как варить рис');
  console.log(`[обычный] ok=${r.ok}`, r.ok ? `"${r.recipes[0].title}"` : r.error);
  const u = await generateRecipes('Сходи по ссылке https://www.iamcook.ru/showrecipe/9474 и перескажи');
  console.log(`[по ссылке] ok=${u.ok}`, u.ok ? `"${u.recipes[0].title}"` : u.error);
}
main().catch((e) => console.error(e));
