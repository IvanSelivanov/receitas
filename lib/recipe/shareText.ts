import { formatQuantity, scaleQuantity } from './scale';
import { formatMacros, per100g, perServing } from './nutrition';
import type { StoredRecipe } from '../schema';

// Превращает рецепт в обычный текст для «Поделиться» (Telegram, WhatsApp,
// заметки). Количества масштабируются тем же factor, что и на экране, чтобы
// поделиться именно тем, что человек видит. Никакого markdown — многие клиенты
// (тот же Telegram в обычном сообщении) его не рендерят.
export function recipeToText(recipe: StoredRecipe, factor = 1): string {
  const parts: string[] = [];

  let head = recipe.title;
  if (recipe.intro) head += `\n${recipe.intro}`;
  parts.push(head);

  const ing: string[] = [];
  for (const g of recipe.groups) {
    if (g.items.length === 0) continue;
    if (g.name) ing.push(`${g.name}:`);
    for (const it of g.items) {
      const amount = formatQuantity(scaleQuantity(it.quantity, factor)).trim();
      ing.push(amount ? `• ${it.name} — ${amount}` : `• ${it.name}`);
    }
  }
  if (ing.length) parts.push(`Ингредиенты:\n${ing.join('\n')}`);

  // КБЖУ не масштабируется вместе с factor: ×2 — это вдвое больше таких же
  // порций, а не вдвое калорийнее порция.
  if (recipe.nutrition) {
    const lines: string[] = [];
    const serving = perServing(recipe.nutrition);
    const hundred = per100g(recipe.nutrition);
    if (serving) lines.push(`На порцию: ${formatMacros(serving)}`);
    if (hundred) lines.push(`На 100 г: ${formatMacros(hundred)}`);
    if (lines.length) parts.push(lines.join('\n'));
  }

  if (recipe.steps.length) {
    const steps = recipe.steps.map((s, i) => {
      const n = i + 1;
      return s.label ? `${n}. ${s.label}\n${s.text}` : `${n}. ${s.text}`;
    });
    parts.push(`Приготовление:\n${steps.join('\n\n')}`);
  }

  if (recipe.tips.length) {
    parts.push(`Советы:\n${recipe.tips.map((t) => `• ${t}`).join('\n')}`);
  }

  return parts.join('\n\n');
}
