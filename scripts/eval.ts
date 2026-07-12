// Eval: прогоняем реальные примеры (examples/, как txt-фикстуры) через полный
// пайплайн generateRecipes и проверяем, что извлечение не деградировало.
// Ловит регрессии промпта/модели: неверное число рецептов, потеря групп/шагов.
//   npm run eval   (или node --env-file=.env.local --import tsx scripts/eval.ts)
import { readFileSync } from 'node:fs';
import { generateRecipes } from '../lib/gemini/generate';

interface Case {
  name: string;
  fixture: string;
  expectedRecipes: number; // сколько отдельных рецептов в тексте
}

// Ожидания взяты из реального содержимого файлов:
//  asian_chicken — 1 рецепт, chicken_breast — 3 (пронумерованы), raia — 2 (Способ 1/2).
const CASES: Case[] = [
  { name: 'asian_chicken', fixture: 'eval/fixtures/asian_chicken.txt', expectedRecipes: 1 },
  { name: 'chicken_breast', fixture: 'eval/fixtures/chicken_breast.txt', expectedRecipes: 3 },
  { name: 'raia', fixture: 'eval/fixtures/raia.txt', expectedRecipes: 2 },
];

async function runCase(c: Case): Promise<boolean> {
  const text = readFileSync(c.fixture, 'utf8').trim();
  const prompt =
    'Структурируй в JSON рецепт(ы) из этого текста, ничего не выдумывая и не добавляя. ' +
    'Каждый отдельный рецепт в тексте — отдельный элемент recipes.\n\nТЕКСТ:\n' +
    text;

  const r = await generateRecipes(prompt);

  const checks: [string, boolean][] = [['валидная структура (ok)', r.ok]];
  if (r.ok) {
    checks.push([
      `число рецептов ${r.recipes.length}/${c.expectedRecipes}`,
      r.recipes.length === c.expectedRecipes,
    ]);
    checks.push([
      'у всех рецептов есть ингредиенты',
      r.recipes.every((x) => x.groups.some((g) => g.items.length > 0)),
    ]);
    checks.push(['у всех рецептов есть шаги', r.recipes.every((x) => x.steps.length > 0)]);
    checks.push([
      'таймеры распознаны хотя бы в одном шаге',
      r.recipes.some((x) => x.steps.some((s) => s.timers.length > 0)),
    ]);
  }

  const passed = checks.every(([, ok]) => ok);
  console.log(`[${c.name}] ${passed ? 'PASS' : 'FAIL'}`);
  for (const [label, ok] of checks) console.log(`   ${ok ? '✓' : '✗'} ${label}`);
  if (!r.ok) console.log(`   error: ${r.error}`);
  return passed;
}

async function main() {
  console.log('EVAL: извлечение рецептов из examples/\n');
  let passed = 0;
  for (const c of CASES) {
    if (await runCase(c)) passed++;
  }
  console.log(`\nИТОГ: ${passed}/${CASES.length} кейсов прошли`);
  process.exit(passed === CASES.length ? 0 : 1);
}

main().catch((e) => {
  console.error('EVAL THROW:', e instanceof Error ? e.message : e);
  process.exit(1);
});
