// Считаем покрытие количествами на шагах после фолбэка.
//   node --env-file=.env.local --import tsx scripts/diag.ts
import { generateRecipes } from '../lib/gemini/generate';

async function main() {
  const r = await generateRecipes('Дай подробный рецепт классического борща с говядиной на 6 порций, много шагов');
  if (!r.ok) { console.log('FAIL:', r.error); return; }
  const rec = r.recipes[0];
  const allUses = rec.steps.flatMap((s) => s.uses);
  const withQty = allUses.filter((u) => u.quantity != null).length;
  console.log(`"${rec.title}" — шагов ${rec.steps.length}`);
  console.log(`uses всего: ${allUses.length}, с количеством: ${withQty}, без: ${allUses.length - withQty}`);
  console.log('\nпримеры (шаг: ингредиент = количество):');
  rec.steps.forEach((s, i) => {
    s.uses.forEach((u) => {
      const q = u.quantity ? JSON.stringify(u.quantity).slice(0, 40) : (u.note ?? 'НЕТ');
      console.log(`  шаг${i + 1}: ${u.ingredientName} = ${q}`);
    });
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
