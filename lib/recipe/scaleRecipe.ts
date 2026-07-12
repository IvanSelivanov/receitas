import { scaleQuantity } from './scale';
import type { StoredRecipe } from '../schema';

/**
 * Применяет множитель ко всему рецепту: количества мастер-списка и количества
 * в шагах (steps[].uses). Нечисловые ("по вкусу") не трогает — см. scaleQuantity.
 * factor === 1 возвращает исходный объект без копирования.
 */
export function scaleRecipe(r: StoredRecipe, factor: number): StoredRecipe {
  if (factor === 1) return r;
  return {
    ...r,
    groups: r.groups.map((g) => ({
      ...g,
      items: g.items.map((it) => ({ ...it, quantity: scaleQuantity(it.quantity, factor) })),
    })),
    steps: r.steps.map((s) => ({
      ...s,
      uses: s.uses.map((u) => ({
        ...u,
        quantity: u.quantity ? scaleQuantity(u.quantity, factor) : null,
      })),
    })),
  };
}

/** Доступные множители в UI. */
export const FACTORS = [0.5, 1, 1.5, 2] as const;
