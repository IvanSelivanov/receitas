import { generateRecipes } from '../lib/gemini/generate';

async function main() {
  const first = await generateRecipes('быстрый ужин из куриной грудки');
  const t1 = first.ok ? first.recipes.map((r) => r.title) : [];
  console.log('[1-й]', first.ok ? t1.join(' | ') : first.error);

  const second = await generateRecipes('быстрый ужин из куриной грудки', undefined, t1);
  const t2 = second.ok ? second.recipes.map((r) => r.title) : [];
  console.log('[другой вариант]', second.ok ? t2.join(' | ') : second.error);

  const overlap = t2.filter((t) => t1.includes(t));
  console.log('[совпадения]', overlap.length ? overlap.join(', ') : 'нет — ок');
}
main().catch((e) => console.error(e));
