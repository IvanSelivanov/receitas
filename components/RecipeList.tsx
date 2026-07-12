'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecipeListItem } from '@/lib/recipe/db';
import type { Category } from '@/lib/recipe/categories';

// Список рецептов: фильтр по категориям + выбор нескольких для списка покупок.
export function RecipeList({
  recipes,
  categories,
  links,
}: {
  recipes: RecipeListItem[];
  categories: Category[];
  links: Record<string, string[]>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCat, setActiveCat] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const shown = activeCat
    ? recipes.filter((r) => (links[r.id] ?? []).includes(activeCat))
    : recipes;

  return (
    <>
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>
            Все
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </Chip>
          ))}
          <Link
            href="/categories"
            className="ml-auto text-sm text-neutral-500 hover:underline"
          >
            Категории
          </Link>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-10 text-center text-neutral-500">В этой категории пусто.</p>
      ) : (
        <ul className="flex flex-col gap-2 pb-20">
          {shown.map((r) => (
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
      )}

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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
