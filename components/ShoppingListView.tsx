'use client';

import { useState } from 'react';
import type { ShoppingItem } from '@/lib/recipe/shoppingList';

// Список покупок с отметкой купленного (локально, зачёркивание).
export function ShoppingListView({ items }: { items: ShoppingItem[] }) {
  const [bought, setBought] = useState<Set<string>>(new Set());

  if (items.length === 0) {
    return <p className="text-neutral-500">Пусто.</p>;
  }

  function toggle(name: string) {
    setBought((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {items.map((it) => {
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
        <button
          onClick={() => setBought(new Set())}
          className="self-start text-sm text-neutral-500 hover:underline"
        >
          Снять отметки
        </button>
      )}
    </div>
  );
}
