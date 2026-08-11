'use client';

import { useState } from 'react';
import {
  per100g,
  perServing,
  servingWeightG,
  type Macros,
  type StoredNutrition,
} from '@/lib/recipe/nutrition';

// Блок КБЖУ: две колонки — на порцию и на 100 г. Обе не зависят от множителя
// порций (×2 даёт вдвое больше таких же порций), поэтому factor сюда не идёт.

const MACROS: { key: keyof Macros; label: string }[] = [
  { key: 'kcal', label: 'ккал' },
  { key: 'protein', label: 'белки, г' },
  { key: 'fat', label: 'жиры, г' },
  { key: 'carbs', label: 'углеводы, г' },
];

function Column({ title, subtitle, macros }: { title: string; subtitle?: string; macros: Macros }) {
  return (
    <div className="flex-1 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800/60">
      <p className="text-xs font-medium text-neutral-500">
        {title}
        {subtitle && <span className="font-normal text-neutral-400"> · {subtitle}</span>}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{macros.kcal} ккал</p>
      <dl className="mt-1 flex flex-col gap-0.5 text-xs text-neutral-600 dark:text-neutral-400">
        {MACROS.slice(1).map(({ key, label }) => (
          <div key={key} className="flex justify-between gap-2">
            <dt>{label}</dt>
            <dd className="tabular-nums">{macros[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Только показ (превью на экране генерации, где пересчитывать нечего). */
export function NutritionFacts({ nutrition }: { nutrition: StoredNutrition | null | undefined }) {
  if (!nutrition) return null;

  const serving = perServing(nutrition);
  const hundred = per100g(nutrition);
  if (!serving && !hundred) return null;

  const weight = servingWeightG(nutrition);

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Пищевая ценность
      </h3>
      <div className="flex gap-2">
        {serving && (
          <Column
            title="На порцию"
            subtitle={weight ? `≈ ${weight} г` : undefined}
            macros={serving}
          />
        )}
        {hundred && <Column title="На 100 г" macros={hundred} />}
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">
        Оценка по ингредиентам — точность зависит от продуктов и способа готовки.
        {!serving && ' Число порций в рецепте не указано.'}
        {nutrition.note ? ` ${nutrition.note}` : ''}
      </p>
    </section>
  );
}

/** Показ + расчёт/пересчёт для сохранённого рецепта. */
export function NutritionPanel({
  recipeId,
  initial,
}: {
  recipeId: string;
  initial: StoredNutrition | null | undefined;
}) {
  const [nutrition, setNutrition] = useState<StoredNutrition | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function compute() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        nutrition?: StoredNutrition | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Не удалось рассчитать');
      } else if (!data.nutrition) {
        setError('По этому рецепту не хватает количеств для расчёта.');
      } else {
        setNutrition(data.nutrition);
      }
    } catch {
      setError('Сеть недоступна. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      {nutrition ? (
        <NutritionFacts nutrition={nutrition} />
      ) : (
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Пищевая ценность
        </h3>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={compute}
          disabled={loading}
          className={
            nutrition
              ? 'text-xs text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50'
              : 'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200'
          }
        >
          {loading ? 'Считаю…' : nutrition ? 'Пересчитать' : 'Рассчитать КБЖУ'}
        </button>
        {!nutrition && !error && !loading && (
          <span className="text-xs text-neutral-400">калории и БЖУ на порцию и на 100 г</span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
