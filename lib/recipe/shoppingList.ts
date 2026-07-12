import { formatQuantity, type Quantity } from './scale';
import type { StoredRecipe } from '../schema';

export interface ShoppingItem {
  name: string;
  lines: string[]; // отображаемые количества; обычно одно, несколько — при разных единицах
}

// Ключи для слияния: имя без регистра/пробелов, единица без регистра/пробелов.
// Решение Eng Review: складываем только одинаковые единицы, конвертации нет.
function normName(n: string): string {
  return n.trim().toLowerCase();
}
function unitKey(u: string | null): string {
  return (u ?? '').trim().toLowerCase();
}

interface Acc {
  displayName: string;
  // unitKey -> суммарный диапазон [min,max] (число хранится как min===max)
  units: Map<string, { unit: string | null; min: number; max: number }>;
  texts: Set<string>; // «по вкусу», «горсть» и т.п.
}

/**
 * Собирает единый список покупок из нескольких рецептов.
 * Одинаковые ингредиенты с одинаковой единицей суммируются; с разными единицами
 * — показываются отдельными строками; нечисловые («по вкусу») — как есть.
 * Использует базовые количества рецепта (без множителя порций).
 */
export function buildShoppingList(recipes: StoredRecipe[]): ShoppingItem[] {
  const acc = new Map<string, Acc>();

  for (const r of recipes) {
    for (const g of r.groups) {
      for (const it of g.items) {
        const key = normName(it.name);
        let a = acc.get(key);
        if (!a) {
          a = { displayName: it.name, units: new Map(), texts: new Set() };
          acc.set(key, a);
        }
        const q = it.quantity;
        if (q.kind === 'text') {
          a.texts.add(q.raw.trim());
        } else {
          const uk = unitKey(q.unit);
          const min = q.kind === 'number' ? q.value : q.min;
          const max = q.kind === 'number' ? q.value : q.max;
          const bucket = a.units.get(uk);
          if (bucket) {
            bucket.min += min;
            bucket.max += max;
          } else {
            a.units.set(uk, { unit: q.unit, min, max });
          }
        }
      }
    }
  }

  const items: ShoppingItem[] = [];
  for (const a of acc.values()) {
    const lines: string[] = [];
    for (const b of a.units.values()) {
      const q: Quantity =
        b.min === b.max
          ? { kind: 'number', value: b.min, unit: b.unit, raw: '' }
          : { kind: 'range', min: b.min, max: b.max, unit: b.unit, raw: '' };
      lines.push(formatQuantity(q));
    }
    // Текстовые количества показываем, только если нет числовых (иначе число важнее).
    if (lines.length === 0) {
      for (const t of a.texts) lines.push(t);
    }
    items.push({ name: a.displayName, lines: lines.length ? lines : [''] });
  }

  items.sort((x, y) => x.name.localeCompare(y.name, 'ru'));
  return items;
}
