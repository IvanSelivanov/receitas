'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecipeBody } from '@/components/RecipeBody';
import { createClient } from '@/lib/supabase/client';
import { saveRecipes } from '@/lib/recipe/db';
import { compressImage } from '@/lib/image/compress';
import type { StoredRecipe } from '@/lib/schema';

interface GenResult {
  ok: boolean;
  recipes: StoredRecipe[];
  raw?: string;
  error?: string;
}

interface Media {
  mimeType: string;
  dataB64: string;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(blob);
  });
}

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  // Названия всех показанных за сессию рецептов — чтобы «Другой вариант» не повторялся.
  const [seen, setSeen] = useState<string[]>([]);

  // Готовит тело запроса: текст, картинку/PDF (media) или текст из файла.
  async function buildPayload(): Promise<{ prompt: string; media?: Media }> {
    if (!file) return { prompt };
    if (file.type.startsWith('image/')) {
      const blob = await compressImage(file);
      return { prompt, media: { mimeType: 'image/jpeg', dataB64: await toBase64(blob) } };
    }
    if (file.type === 'application/pdf') {
      if (file.size > 3_000_000) throw new Error('PDF слишком большой (до ~3 МБ)');
      return { prompt, media: { mimeType: 'application/pdf', dataB64: await toBase64(file) } };
    }
    // Текстовый файл — читаем и отдаём как обычный запрос.
    const text = (await file.text()).trim();
    if (!text) throw new Error('Файл пустой');
    return { prompt: `Извлеки рецепт(ы) из текста${prompt ? ` (${prompt})` : ''}:\n\n${text}` };
  }

  // Один прогон генерации. avoid — названия рецептов, которые не надо повторять
  // (для «Другого варианта»). Показанные названия копим в seen.
  async function run(avoid: string[]) {
    setLoading(true);
    setError('');
    setRaw('');
    try {
      const payload = await buildPayload();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, avoid }),
      });
      const data = (await res.json()) as GenResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Не удалось сгенерировать');
        if (data.raw) setRaw(data.raw);
      } else {
        setRecipes(data.recipes);
        setSelected(new Set(data.recipes.map((_, i) => i)));
        setSeen((prev) => [...prev, ...data.recipes.map((r) => r.title)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сеть недоступна. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() && !file) return;
    setRecipes([]);
    setSelected(new Set());
    setSeen([]); // новый запрос — забываем прошлые названия
    run([]);
  }

  // «Другой вариант»: тот же запрос, но модели говорим не повторять уже виденное.
  function regenerate() {
    if (loading) return;
    run(seen);
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
          rows={3}
          placeholder="Что приготовить? Например: быстрый ужин из куриной грудки и риса. Или вставь текст рецепта / ссылку."
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300"
          >
            📎 Загрузить файл
          </button>
          <span className="text-xs text-neutral-400">фото, скриншот, PDF или текст</span>
          {file && (
            <span className="flex items-center gap-1 text-sm">
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = '';
                }}
                className="text-neutral-400 hover:text-red-600"
                aria-label="Убрать файл"
              >
                ✕
              </button>
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf,.txt,.md,.rtf,text/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="submit"
          disabled={loading || (!prompt.trim() && !file)}
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={save}
              disabled={saving || loading || selected.size === 0}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {saving ? 'Сохраняю…' : `Сохранить (${selected.size})`}
            </button>
            <button
              onClick={regenerate}
              disabled={loading || saving}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200"
            >
              {loading ? 'Генерирую…' : '↻ Другой вариант'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
