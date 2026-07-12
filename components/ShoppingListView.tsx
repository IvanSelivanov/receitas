'use client';

import { useEffect, useState } from 'react';
import type { ShoppingItem } from '@/lib/recipe/shoppingList';

// Список покупок с отметкой купленного. Купленные уезжают в конец. Если задан
// storageKey — отметки сохраняются в localStorage (переживают перезагрузку,
// в т.ч. офлайн).
export function ShoppingListView({
  items,
  storageKey,
}: {
  items: ShoppingItem[];
  storageKey?: string;
}) {
  const [bought, setBought] = useState<Set<string>>(new Set());

  // Загружаем сохранённые отметки после монтирования (без SSR-рассинхрона).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(`${storageKey}:bought`);
      if (raw) setBought(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function persist(next: Set<string>) {
    if (!storageKey) return;
    try {
      localStorage.setItem(`${storageKey}:bought`, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }

  function toggle(name: string) {
    setBought((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      persist(next);
      return next;
    });
  }

  function clearAll() {
    setBought(new Set());
    persist(new Set());
  }

  if (items.length === 0) {
    return <p className="text-neutral-500">Пусто.</p>;
  }

  // Купленные уезжают в конец. Sort стабильный -> порядок внутри групп сохраняется.
  const ordered = [...items].sort(
    (a, b) => (bought.has(a.name) ? 1 : 0) - (bought.has(b.name) ? 1 : 0),
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {ordered.map((it) => {
          const done = bought.has(it.name);
          return (
            <li key={it.name} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(it.name)}
                  className="size-4 shrink-0"
                />
                <span className={`flex-1 ${done ? 'text-neutral-400 line-through' : ''}`}>{it.name}</span>
                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    done ? 'text-neutral-300 line-through' : 'text-neutral-500'
                  }`}
                >
                  {it.lines.join(' + ')}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {bought.size > 0 && (
        <button onClick={clearAll} className="self-start text-sm text-neutral-500 hover:underline">
          Снять отметки
        </button>
      )}
    </div>
  );
}
