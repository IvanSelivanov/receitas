// Смоук-проверка живых интеграций. Запуск:
//   node --env-file=.env.local --import tsx scripts/smoke.ts
// Значения ключей НЕ печатаются.

import { generateRecipes } from '../lib/gemini/generate';

async function checkGemini() {
  console.log('\n=== Gemini ===');
  const res = await generateRecipes('Дай быстрый рецепт из куриной грудки и риса на 2 порции');
  if (!res.ok) {
    console.log('❌ ok:', res.ok, '| error:', res.error);
    if (res.raw) console.log('   raw (первые 200):', res.raw.slice(0, 200));
    return false;
  }
  console.log('✅ рецептов:', res.recipes.length);
  const r = res.recipes[0];
  console.log('   title:', r.title);
  console.log('   groups:', r.groups.length, '| steps:', r.steps.length, '| tips:', r.tips.length);
  const ing = r.groups[0]?.items[0];
  console.log('   1-й ингредиент:', ing?.name, '->', JSON.stringify(ing?.quantity));
  const withUses = r.steps.find((s) => s.uses.length > 0);
  if (withUses) {
    const u = withUses.uses[0];
    console.log('   шаг с uses:', `"${withUses.label ?? withUses.text.slice(0, 30)}"`, '| ref:', u.ref, '| ing:', u.ingredientName);
  } else {
    console.log('   (шагов с uses модель не вернула — best-effort, это ок)');
  }
  return true;
}

async function checkSupabase() {
  console.log('\n=== Supabase ===');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log('❌ URL или publishable key не заданы');
    return false;
  }
  try {
    // auth/v1/settings принимает publishable-ключ и не требует таблиц —
    // корректный публичный пробник (rest/v1 root в новой системе требует secret).
    const resp = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (resp.ok) {
      console.log('✅ URL верный, publishable-ключ принят (HTTP', resp.status + ')');
      return true;
    }
    console.log('❌ HTTP', resp.status, '- URL достижим, но ключ отклонён');
    return false;
  } catch (e) {
    console.log('❌ сеть/URL:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

async function main() {
  const g = await checkGemini();
  const s = await checkSupabase();
  console.log('\n=== ИТОГ ===');
  console.log('Gemini:  ', g ? 'OK' : 'FAIL');
  console.log('Supabase:', s ? 'OK' : 'FAIL');
  process.exit(g && s ? 0 : 1);
}

main();
