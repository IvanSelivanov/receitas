'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getRecipesByIds } from '@/lib/recipe/db';
import { buildShoppingList, type ShoppingItem } from '@/lib/recipe/shoppingList';
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
export function ShoppingList() {
  const [data, setData] = useState<Cached | null>(null);
  const [cacheKey, setCacheKey] = useState<string>('');
  const [state, setState] = useState<'loading' | 'online' | 'offline' | 'empty'>('loading');

  useEffect(() => {
    const ids = new URLSearchParams(window.location.search)
      .get('ids');
    const idList = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    const key = `shopping:${idList.join(',')}`;
    setCacheKey(key);

    // 1. Мгновенно из кэша.
    let cached: Cached | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) cached = JSON.parse(raw) as Cached;
    } catch {
      /* ignore */
    }
    if (cached) {
      setData(cached);
      setState('offline');
    }

    // 2. Обновление из сети (если доступна).
    (async () => {
      if (idList.length === 0) {
        if (!cached) setState('empty');
        return;
      }
      try {
        const supabase = createClient();
        const recipes = await getRecipesByIds(supabase, idList);
        const fresh: Cached = {
          items: buildShoppingList(recipes),
          titles: recipes.map((r) => r.title),
        };
        setData(fresh);
        setState('online');
        try {
          localStorage.setItem(key, JSON.stringify(fresh));
        } catch {
          /* ignore */
        }
      } catch {
        setState(cached ? 'offline' : 'empty');
      }
    })();
  }, []);

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
