'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecipeListItem } from '@/lib/recipe/db';

// Список рецептов с выбором нескольких для списка покупок.
export function RecipeList({ recipes }: { recipes: RecipeListItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-2 pb-20">
        {recipes.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Выбрать «${r.title}» для списка покупок`}
              className="size-4 shrink-0"
            />
            <Link href={`/recipe/${r.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 flex justify-center p-4">
          {/* Полный переход (не client-nav): чтобы service worker закэшировал
              документ /shopping и отдавал его офлайн. */}
          <a
            href={`/shopping?ids=${[...selected].join(',')}`}
            className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900"
          >
            Список покупок ({selected.size})
          </a>
        </div>
      )}
    </>
  );
}
