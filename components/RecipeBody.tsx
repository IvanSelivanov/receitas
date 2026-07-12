'use client';
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { formatQuantity, scaleQuantity } from '@/lib/recipe/scale';
import type { StoredRecipe, StoredGroup, StoredStep } from '@/lib/schema';
import { PhotoUpload } from './PhotoUpload';

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// Список ингредиентов. groups — ВСЕГДА оригинал (нескейленный); отображаемое
// количество считается как scaleQuantity(item, factor). В editable-режиме
// числовые поля редактируемы: ввод N в поле с исходным значением V задаёт
// глобальный factor = N / V, и весь рецепт пересчитывается синхронно.
export function IngredientList({
  groups,
  factor = 1,
  editable = false,
  onSetFactor,
}: {
  groups: StoredGroup[];
  factor?: number;
  editable?: boolean;
  onSetFactor?: (factor: number) => void;
}) {
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Ингредиенты
      </h3>
      <div className="flex flex-col gap-3">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.name && <p className="mb-1 text-sm font-medium">{g.name}</p>}
            <ul className="flex flex-col gap-1.5">
              {g.items.map((it) => {
                const scaled = scaleQuantity(it.quantity, factor);
                const canEdit = editable && it.quantity.kind === 'number' && it.quantity.value > 0;
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{it.name}</span>
                    {canEdit && scaled.kind === 'number' ? (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <input
                          inputMode="decimal"
                          value={draft?.id === it.id ? draft.text : fmtNum(scaled.value)}
                          onChange={(e) => {
                            const text = e.target.value;
                            setDraft({ id: it.id, text });
                            const n = parseFloat(text.replace(',', '.'));
                            const base = it.quantity.kind === 'number' ? it.quantity.value : 0;
                            if (Number.isFinite(n) && n >= 0 && base > 0) onSetFactor?.(n / base);
                          }}
                          onBlur={() => setDraft(null)}
                          className="w-16 rounded border border-neutral-300 px-2 py-0.5 text-right tabular-nums outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
                        />
                        {scaled.unit && <span className="text-neutral-500">{scaled.unit}</span>}
                      </span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-neutral-500">
                        {formatQuantity(scaled)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// Шаги. steps — уже отмасштабированные (передаёт вызывающий).
// Если переданы stepImages/onStepPhoto — под каждым шагом загрузчик фото;
// иначе (read-only превью) фото просто показывается, если оно есть.
export function RecipeSteps({
  steps,
  stepImages,
  onStepPhoto,
}: {
  steps: StoredStep[];
  stepImages?: (string | null | undefined)[];
  onStepPhoto?: (index: number, file: File) => Promise<void>;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Шаги</h3>
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => {
          const img = stepImages?.[i] ?? s.imageUrl ?? null;
          return (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-sm tabular-nums text-neutral-400">{i + 1}.</span>
              <div className="min-w-0 flex-1 text-sm">
                {s.label && <p className="font-medium">{s.label}</p>}
                <p>{s.text}</p>
                {s.uses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.uses.map((u, ui) => (
                      <span
                        key={ui}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {u.ingredientName}
                        {u.quantity ? ` · ${formatQuantity(u.quantity)}` : u.note ? ` · ${u.note}` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {(s.timers.length > 0 || s.temperatureC != null) && (
                  <p className="mt-1 text-xs text-neutral-400">
                    {s.timers
                      .map((t) => (t.minMin === t.maxMin ? `${t.minMin} мин` : `${t.minMin}–${t.maxMin} мин`))
                      .join(', ')}
                    {s.timers.length > 0 && s.temperatureC != null ? ' · ' : ''}
                    {s.temperatureC != null ? `${s.temperatureC}°C` : ''}
                  </p>
                )}
                {onStepPhoto ? (
                  <div className="mt-2">
                    <PhotoUpload compact current={img} onSelect={(f) => onStepPhoto(i, f)} label="фото шага" />
                  </div>
                ) : (
                  img && <img src={img} alt="" className="mt-2 max-h-56 rounded-lg object-cover" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function RecipeTips({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Советы</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        {tips.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

// Read-only целый рецепт (превью на экране генерации).
export function RecipeBody({ recipe }: { recipe: StoredRecipe }) {
  return (
    <div className="flex flex-col gap-6">
      {recipe.intro && <p className="text-neutral-600 dark:text-neutral-400">{recipe.intro}</p>}
      <IngredientList groups={recipe.groups} />
      <RecipeSteps steps={recipe.steps} />
      <RecipeTips tips={recipe.tips} />
    </div>
  );
}
