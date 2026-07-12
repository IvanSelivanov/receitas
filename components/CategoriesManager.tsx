'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createCategory, deleteCategory, type Category } from '@/lib/recipe/categories';

// Управление категориями: создать и удалить. Удаление снимает метку со всех
// рецептов (сами рецепты не трогаются — каскад по recipe_categories).
export function CategoriesManager({ userId, initial }: { userId: string; initial: Category[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [cats, setCats] = useState<Category[]>(initial);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setErr('');
    try {
      const cat = await createCategory(supabase, userId, n);
      setCats((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      setName('');
    } catch {
      setErr('Не удалось добавить (возможно, такая категория уже есть).');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteCategory(supabase, id);
      setCats((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setErr('Не удалось удалить.');
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новая категория"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Добавить
        </button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {cats.length === 0 ? (
        <p className="text-neutral-500">Категорий пока нет.</p>
      ) : (
        <ul className="flex flex-col">
          {cats.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-neutral-200 py-2.5 last:border-0 dark:border-neutral-800"
            >
              <span>{c.name}</span>
              {confirmId === c.id ? (
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-500">Удалить?</span>
                  <button onClick={() => remove(c.id)} className="font-medium text-red-600">
                    Да
                  </button>
                  <button onClick={() => setConfirmId(null)} className="text-neutral-500">
                    Нет
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmId(c.id)}
                  aria-label={`Удалить категорию «${c.name}»`}
                  className="text-neutral-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
