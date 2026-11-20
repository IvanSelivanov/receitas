'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getRecipesByIds } from '@/lib/recipe/db';
import { buildShoppingList, type ShoppingItem } from '@/lib/recipe/shoppingList';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { ShoppingListView } from './ShoppingListView';

interface Cached {
  items: ShoppingItem[];
  titles: string[];
}

// Список покупок с офлайн-поддержкой:
//  1) читает ids из URL,
//  2) мгновенно показывает сохранённую версию из localStorage,
//  3) если сеть есть — пересобирает из Supabase и обновляет кэш.
// В магазине без сети (или при переоткрытии) работает шаг 2.
// Строка запроса — внешний стор без подписки: меняется только навигацией,
// которая перемонтирует страницу. На сервере null (страница ещё «грузится»).
// Читаем window.location, а не useSearchParams: офлайн service worker может
// отдать закэшированную HTML-оболочку от другого набора ids.
const noSubscribe = () => () => {};

function parseCached(raw: string | null): Cached | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Cached;
  } catch {
    return null;
  }
}

export function ShoppingList() {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => null);
  const idList = useMemo(
    () =>
      (new URLSearchParams(search ?? '').get('ids') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort(),
    [search],
  );
  const cacheKey = search === null ? '' : `shopping:${idList.join(',')}`;

  // 1. Мгновенно из кэша (localStorage).
  const [cachedRaw, setCachedRaw] = useLocalStorage(cacheKey || null);
  const cached = useMemo(() => parseCached(cachedRaw), [cachedRaw]);

  // 2. Обновление из сети (если доступна).
  const [fresh, setFresh] = useState<Cached | null>(null);
  const [net, setNet] = useState<'loading' | 'online' | 'failed'>('loading');

  useEffect(() => {
    if (search === null || idList.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const recipes = await getRecipesByIds(supabase, idList);
        if (cancelled) return;
        const next: Cached = {
          items: buildShoppingList(recipes),
          titles: recipes.map((r) => r.title),
        };
        setFresh(next);
        setNet('online');
        setCachedRaw(JSON.stringify(next));
      } catch {
        if (!cancelled) setNet('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, idList, setCachedRaw]);

  const data = fresh ?? cached;
  const state: 'loading' | 'online' | 'offline' | 'empty' =
    search === null
      ? 'loading'
      : net === 'online'
        ? 'online'
        : cached
          ? 'offline'
          : idList.length === 0 || net === 'failed'
            ? 'empty'
            : 'loading';

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Все рецепты
        </Link>
        {state === 'offline' && (
          <span className="text-xs text-amber-600">офлайн — сохранённый список</span>
        )}
      </header>

      <h1 className="text-2xl font-semibold">Список покупок</h1>
      {data && data.titles.length > 0 && (
        <p className="mb-5 mt-1 text-sm text-neutral-500">
          Из {data.titles.length} рецепт(ов): {data.titles.join(', ')}
        </p>
      )}

      {state === 'loading' && !data ? (
        <p className="mt-4 text-neutral-500">Загрузка…</p>
      ) : state === 'empty' && !data ? (
        <p className="mt-4 text-neutral-500">
          Список пуст или недоступен офлайн. Открой его хотя бы раз с интернетом — дальше будет
          работать и без сети.
        </p>
      ) : (
        <ShoppingListView items={data?.items ?? []} storageKey={cacheKey} />
      )}
    </main>
  );
}
