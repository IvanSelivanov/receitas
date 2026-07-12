'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { setRecipeContent, type RecipeRecord } from '@/lib/recipe/db';
import { toEditGroups, buildEditedRecipe, type EditGroup } from '@/lib/recipe/edit';
import type { StoredStep } from '@/lib/schema';

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `new-${Date.now()}-${Math.random()}`;

const inputCls =
  'rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950';

export function RecipeEditor({ recipe }: { recipe: RecipeRecord }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<EditGroup[]>(() => toEditGroups(recipe.groups));
  const [steps, setSteps] = useState<StoredStep[]>(recipe.steps);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- ингредиенты ---
  function setGroup(gi: number, patch: Partial<EditGroup>) {
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function setItem(gi: number, ii: number, field: 'name' | 'amount', value: string) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, [field]: value } : it)) } : g,
      ),
    );
  }
  function addItem(gi: number) {
    setGroups((prev) =>
      prev.map((g, i) => (i === gi ? { ...g, items: [...g.items, { id: newId(), name: '', amount: '' }] } : g)),
    );
  }
  function removeItem(gi: number, ii: number) {
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, items: g.items.filter((_, j) => j !== ii) } : g)));
  }
  function addGroup() {
    setGroups((prev) => [...prev, { name: '', items: [{ id: newId(), name: '', amount: '' }] }]);
  }
  function removeGroup(gi: number) {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
  }

  // --- шаги ---
  function setStep(si: number, field: 'label' | 'text', value: string) {
    setSteps((prev) => prev.map((s, i) => (i === si ? { ...s, [field]: value } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, { label: null, text: '', timers: [], temperatureC: null, uses: [] }]);
  }
  function removeStep(si: number) {
    setSteps((prev) => prev.filter((_, i) => i !== si));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { groups: g, steps: s } = buildEditedRecipe(groups, steps);
      await setRecipeContent(supabase, recipe.id, g, s);
      router.push(`/recipe/${recipe.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Ингредиенты */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Ингредиенты</h2>
        <div className="flex flex-col gap-4">
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={g.name}
                  onChange={(e) => setGroup(gi, { name: e.target.value })}
                  placeholder="Группа (необязательно, напр. «Для соуса»)"
                  className={`flex-1 ${inputCls}`}
                />
                {groups.length > 1 && (
                  <button
                    onClick={() => removeGroup(gi)}
                    className="shrink-0 text-neutral-400 hover:text-red-600"
                    aria-label="Удалить группу"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((it, ii) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <input
                      value={it.name}
                      onChange={(e) => setItem(gi, ii, 'name', e.target.value)}
                      placeholder="Ингредиент"
                      className={`min-w-0 flex-1 ${inputCls}`}
                    />
                    <input
                      value={it.amount}
                      onChange={(e) => setItem(gi, ii, 'amount', e.target.value)}
                      placeholder="кол-во"
                      className={`w-24 shrink-0 ${inputCls}`}
                    />
                    <button
                      onClick={() => removeItem(gi, ii)}
                      className="shrink-0 text-neutral-400 hover:text-red-600"
                      aria-label="Удалить ингредиент"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addItem(gi)}
                className="mt-2 text-sm text-neutral-500 hover:underline"
              >
                + ингредиент
              </button>
            </div>
          ))}
        </div>
        <button onClick={addGroup} className="mt-3 text-sm text-neutral-500 hover:underline">
          + группа
        </button>
      </section>

      {/* Шаги */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Шаги</h2>
        <div className="flex flex-col gap-3">
          {steps.map((s, si) => (
            <div key={si} className="flex gap-3">
              <span className="mt-2 shrink-0 text-sm tabular-nums text-neutral-400">{si + 1}.</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  value={s.label ?? ''}
                  onChange={(e) => setStep(si, 'label', e.target.value)}
                  placeholder="Заголовок шага (необязательно)"
                  className={inputCls}
                />
                <textarea
                  value={s.text}
                  onChange={(e) => setStep(si, 'text', e.target.value)}
                  rows={2}
                  placeholder="Что делать"
                  className={inputCls}
                />
              </div>
              <button
                onClick={() => removeStep(si)}
                className="mt-2 shrink-0 text-neutral-400 hover:text-red-600"
                aria-label="Удалить шаг"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-3 text-sm text-neutral-500 hover:underline">
          + шаг
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-white via-white p-4 dark:from-neutral-950 dark:via-neutral-950">
        <Link
          href={`/recipe/${recipe.id}`}
          className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-medium dark:border-neutral-700"
        >
          Отмена
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white shadow-lg disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
