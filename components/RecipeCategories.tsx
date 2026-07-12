'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  assignCategory,
  unassignCategory,
  createCategory,
  type Category,
} from '@/lib/recipe/categories';

// Назначение категорий рецепту: все категории — чипы, назначенные подсвечены,
// тап переключает. Ниже — поле для создания новой (сразу назначается).
export function RecipeCategories({
  recipeId,
  userId,
  all,
  assigned,
}: {
  recipeId: string;
  userId: string;
  all: Category[];
  assigned: string[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cats, setCats] = useState<Category[]>(all);
  const [sel, setSel] = useState<Set<string>>(new Set(assigned));
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function toggle(cat: Category) {
    const has = sel.has(cat.id);
    setSel((prev) => {
      const next = new Set(prev);
      if (has) next.delete(cat.id);
      else next.add(cat.id);
      return next;
    });
    try {
      if (has) await unassignCategory(supabase, recipeId, cat.id);
      else await assignCategory(supabase, recipeId, cat.id);
    } catch {
      // откат при ошибке
      setSel((prev) => {
        const next = new Set(prev);
        if (has) next.add(cat.id);
        else next.delete(cat.id);
        return next;
      });
    }
  }

  async function addNew(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const cat = await createCategory(supabase, userId, name);
      setCats((prev) =>
        [...prev, cat].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      );
      await assignCategory(supabase, recipeId, cat.id);
      setSel((prev) => new Set(prev).add(cat.id));
      setNewName('');
    } catch {
      // например, категория с таким именем уже есть
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const on = sel.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  on
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
      <form onSubmit={addNew} className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Новая категория"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          Добавить
        </button>
      </form>
    </div>
  );
}
