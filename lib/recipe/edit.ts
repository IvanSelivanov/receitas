import { parseQuantity, formatQuantity, type Quantity } from './scale';
import type { StoredGroup, StoredStep, StoredStepUse } from '../schema';

// Редактируемые формы (плоские, с amount строкой для поля ввода).
export interface EditItem {
  id: string;
  name: string;
  amount: string;
}
export interface EditGroup {
  name: string;
  items: EditItem[];
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** StoredGroup[] -> редактируемая форма (amount = исходная строка количества). */
export function toEditGroups(groups: StoredGroup[]): EditGroup[] {
  return groups.map((g) => ({
    name: g.name ?? '',
    items: g.items.map((it) => ({
      id: it.id,
      name: it.name,
      amount: it.quantity.raw || formatQuantity(it.quantity),
    })),
  }));
}

/**
 * Собирает сохранимую форму из отредактированных полей: парсит количества,
 * выкидывает пустые ингредиенты/шаги, и пере-привязывает step.uses к
 * отредактированному мастер-списку по имени (обновляет количество, удаляет
 * ссылки на исчезнувшие ингредиенты).
 */
export function buildEditedRecipe(
  editGroups: EditGroup[],
  steps: StoredStep[],
): { groups: StoredGroup[]; steps: StoredStep[] } {
  const outGroups: StoredGroup[] = editGroups
    .map((g) => ({
      name: g.name.trim() || null,
      items: g.items
        .filter((it) => it.name.trim())
        .map((it) => ({ id: it.id, name: it.name.trim(), quantity: parseQuantity(it.amount) })),
    }))
    .filter((g) => g.items.length > 0);

  const nameToId = new Map<string, string>();
  const idToQuantity = new Map<string, Quantity>();
  for (const g of outGroups) {
    for (const it of g.items) {
      nameToId.set(norm(it.name), it.id);
      idToQuantity.set(it.id, it.quantity);
    }
  }

  const outSteps: StoredStep[] = steps
    .filter((s) => s.text.trim())
    .map((s) => ({
      label: s.label && s.label.trim() ? s.label.trim() : null,
      text: s.text.trim(),
      timers: s.timers,
      temperatureC: s.temperatureC,
      uses: s.uses
        .map((u): StoredStepUse | null => {
          const id = nameToId.get(norm(u.ingredientName));
          if (!id) return null; // ингредиент удалён/переименован
          return { ...u, ref: id, quantity: idToQuantity.get(id) ?? u.quantity };
        })
        .filter((u): u is StoredStepUse => u !== null),
    }));

  return { groups: outGroups, steps: outSteps };
}
