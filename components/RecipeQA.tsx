'use client';

import { useState } from 'react';

interface QA {
  q: string;
  a: string;
}

const EXAMPLES = ['Чем заменить сливки?', 'Можно ли без духовки?', 'Сколько это по времени?'];

// Вопрос-ответ по рецепту (замены ингредиентов, уточнения по готовке). История
// в рамках сессии — не сохраняем, это быстрые разовые вопросы.
export function RecipeQA({ recipeId }: { recipeId: string }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<QA[]>([]);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, question: trimmed }),
      });
      const data = (await res.json()) as { ok?: boolean; answer?: string; error?: string };
      if (!res.ok || !data.ok || !data.answer) {
        setError(data.error ?? 'Не удалось получить ответ');
      } else {
        setHistory((h) => [...h, { q: trimmed, a: data.answer as string }]);
        setQuestion('');
      }
    } catch {
      setError('Сеть недоступна. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Спросить по рецепту
      </h3>

      {history.length > 0 && (
        <div className="mb-3 flex flex-col gap-3">
          {history.map((qa, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm font-medium">{qa.q}</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                {qa.a}
              </p>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              disabled={loading}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Чем заменить, как приготовить…"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? '…' : 'Спросить'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
