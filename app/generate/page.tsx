'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeBody } from '@/components/RecipeBody';
import { createClient } from '@/lib/supabase/client';
import { saveRecipes } from '@/lib/recipe/db';
import type { StoredRecipe } from '@/lib/schema';

interface GenResult {
  ok: boolean;
  recipes: StoredRecipe[];
  raw?: string;
  error?: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRaw('');
    setRecipes([]);
    setSelected(new Set());
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as GenResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Не удалось сгенерировать');
        if (data.raw) setRaw(data.raw);
      } else {
        setRecipes(data.recipes);
        // По умолчанию выбираем все (чаще всего 1 рецепт).
        setSelected(new Set(data.recipes.map((_, i) => i)));
      }
    } catch {
      setError('Сеть недоступна. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const chosen = recipes.filter((_, i) => selected.has(i));
      await saveRecipes(supabase, user.id, chosen);
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Новый рецепт</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Назад
        </Link>
      </header>

      <form onSubmit={generate} className="flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={3}
          placeholder="Что приготовить? Например: быстрый ужин из куриной грудки и риса"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? 'Генерирую…' : 'Сгенерировать'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
          {raw && <pre className="mt-2 whitespace-pre-wrap text-xs text-neutral-500">{raw}</pre>}
        </div>
      )}

      {recipes.length > 0 && (
        <section className="mt-6">
          <p className="mb-3 text-sm text-neutral-500">
            {recipes.length > 1
              ? `Найдено ${recipes.length} рецепта — выбери, что сохранить:`
              : 'Готово. Сохранить?'}
          </p>
          <div className="flex flex-col gap-3">
            {recipes.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 transition-colors ${
                  selected.has(i)
                    ? 'border-neutral-900 dark:border-neutral-300'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-1"
                  />
                  <span className="font-medium">{r.title}</span>
                </label>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-neutral-500">Показать</summary>
                  <div className="mt-3">
                    <RecipeBody recipe={r} />
                  </div>
                </details>
              </div>
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {saving ? 'Сохраняю…' : `Сохранить (${selected.size})`}
          </button>
        </section>
      )}
    </main>
  );
}
