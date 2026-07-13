'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { assignCategoryToRecipes, type Category } from '@/lib/recipe/categories';
import type { RecipeListItem } from '@/lib/recipe/db';

type Sort = 'new' | 'old' | 'az' | 'recent';
const SORT_KEY = 'recipe-sort';

// Список рецептов: фильтр по категориям + выбор нескольких (для списка покупок и
// массового назначения категории).
export function RecipeList({
  recipes,
  categories,
  links,
}: {
  recipes: RecipeListItem[];
  categories: Category[];
  links: Record<string, string[]>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [linkMap, setLinkMap] = useState<Record<string, string[]>>(links);
  const [picking, setPicking] = useState(false);
  const [busyCat, setBusyCat] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const [query, setQuery] = useState('');

  // Загружаем сохранённую сортировку (это UI-предпочтение, локально — ок).
  useEffect(() => {
    try {
      const s = localStorage.getItem(SORT_KEY);
      if (s === 'new' || s === 'old' || s === 'az' || s === 'recent') setSort(s);
    } catch {
      /* ignore */
    }
  }, []);

  function changeSort(s: Sort) {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* ignore */
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignTo(cat: Category) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusyCat(cat.id);
    try {
      await assignCategoryToRecipes(supabase, ids, cat.id);
      setLinkMap((prev) => {
        const next = { ...prev };
        for (const rid of ids) {
          const set = new Set(next[rid] ?? []);
          set.add(cat.id);
          next[rid] = [...set];
        }
        return next;
      });
      setSelected(new Set());
      setPicking(false);
      setToast(`Добавлено в «${cat.name}»: ${ids.length}`);
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('Не удалось добавить');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setBusyCat(null);
    }
  }

  function selectCat(id: string | null) {
    setActiveCat(id);
    setQuery(''); // поиск привязан к текущей категории — при смене сбрасываем
  }

  const filtered = activeCat
    ? recipes.filter((r) => (linkMap[r.id] ?? []).includes(activeCat))
    : recipes;

  // Поиск показываем, только когда в текущей категории заметно много рецептов —
  // на коротком списке он лишний.
  const showSearch = filtered.length > 5;
  const q = query.trim().toLowerCase();
  const searched = showSearch && q ? filtered.filter((r) => r.title.toLowerCase().includes(q)) : filtered;

  const shown = [...searched].sort((a, b) => {
    switch (sort) {
      case 'new':
        return b.createdAt.localeCompare(a.createdAt);
      case 'old':
        return a.createdAt.localeCompare(b.createdAt);
      case 'az':
        return a.title.localeCompare(b.title, 'ru');
      case 'recent':
        // ISO-строки сравниваются лексикографически = хронологически; null (не
        // открывался) -> пустая строка -> уходит вниз.
        return (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '');
    }
  });

  return (
    <>
      {categories.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          {/* Горизонтальная прокрутка внутри полосы: чипы не растягивают страницу. */}
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={activeCat === null} onClick={() => selectCat(null)}>
              Все
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => selectCat(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
          <Link href="/categories" className="shrink-0 text-sm text-neutral-500 hover:underline">
            Категории
          </Link>
        </div>
      )}

      {showSearch && (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию"
            aria-label="Поиск по названию"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <select
          value={sort}
          onChange={(e) => changeSort(e.target.value as Sort)}
          aria-label="Сортировка"
          className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-600 outline-none dark:border-neutral-700 dark:text-neutral-300"
        >
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="az">По алфавиту</option>
          <option value="recent">Недавно открытые</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-neutral-500">
          {showSearch && q ? 'Ничего не найдено.' : 'В этой категории пусто.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-24">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={`Выбрать «${r.title}»`}
                className="size-4 shrink-0"
              />
              <Link href={`/recipe/${r.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-24 flex justify-center px-4">
          <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </span>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4">
          {picking && (
            <div className="flex max-w-full flex-wrap justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {categories.length === 0 ? (
                <span className="text-sm text-neutral-500">
                  Нет категорий —{' '}
                  <Link href="/categories" className="underline">
                    создай
                  </Link>
                </span>
              ) : (
                categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => assignTo(c)}
                    disabled={busyCat !== null}
                    className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>
          )}
          <div className="flex justify-center gap-2">
            {categories.length > 0 && (
              <button
                onClick={() => setPicking((p) => !p)}
                className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              >
                В категорию ▾
              </button>
            )}
            {/* Полный переход: чтобы service worker закэшировал /shopping для офлайна. */}
            <a
              href={`/shopping?ids=${[...selected].join(',')}`}
              className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900"
            >
              Список покупок ({selected.size})
            </a>
          </div>
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
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
