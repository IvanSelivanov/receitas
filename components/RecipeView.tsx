'use client';

import { useMemo, useState } from 'react';
import { IngredientList, RecipeSteps, RecipeTips } from './RecipeBody';
import { PhotoUpload } from './PhotoUpload';
import { CookMode } from './CookMode';
import { ShareButton } from './ShareButton';
import { RecipeQA } from './RecipeQA';
import { scaleRecipe, FACTORS } from '@/lib/recipe/scaleRecipe';
import { recipeToText } from '@/lib/recipe/shareText';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/image/compress';
import { uploadPhoto } from '@/lib/recipe/storage';
import { setRecipeImage, setStepImage, type RecipeRecord } from '@/lib/recipe/db';

const isPreset = (f: number) => FACTORS.some((p) => Math.abs(p - f) < 1e-9);

// Детальный просмотр: фото блюда + масштабирование (пресеты и редактируемые
// поля) + шаги с фото. Загрузка фото идёт с клиента: сжатие -> Storage -> запись
// URL в БД -> мгновенное обновление локального состояния.
export function RecipeView({ recipe, userId }: { recipe: RecipeRecord; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [factor, setFactor] = useState(1);
  const [cooking, setCooking] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(recipe.imageUrl);
  const [stepImages, setStepImages] = useState<(string | null | undefined)[]>(
    recipe.steps.map((s) => s.imageUrl ?? null),
  );

  const scaled = scaleRecipe(recipe, factor);

  async function uploadMain(file: File) {
    const blob = await compressImage(file);
    const url = await uploadPhoto(supabase, userId, recipe.id, 'main', blob);
    await setRecipeImage(supabase, recipe.id, url);
    setMainImage(url);
  }

  async function uploadStep(index: number, file: File) {
    const blob = await compressImage(file);
    const url = await uploadPhoto(supabase, userId, recipe.id, `step-${index}`, blob);
    await setStepImage(supabase, recipe.id, index, url);
    setStepImages((prev) => prev.map((v, i) => (i === index ? url : v)));
  }

  return (
    <div className="flex flex-col gap-5">
      <PhotoUpload current={mainImage} onSelect={uploadMain} label="фото блюда" />

      {recipe.intro && <p className="text-neutral-600 dark:text-neutral-400">{recipe.intro}</p>}

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-neutral-500">Порция:</span>
          {FACTORS.map((f) => (
            <button
              key={f}
              onClick={() => setFactor(f)}
              className={`rounded-full px-3 py-1 text-sm tabular-nums transition-colors ${
                Math.abs(factor - f) < 1e-9
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              ×{f}
            </button>
          ))}
          {!isPreset(factor) && (
            <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm tabular-nums text-white dark:bg-white dark:text-neutral-900">
              ×{Math.round(factor * 100) / 100}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-neutral-400">
          Или введи любое число в поле количества — остальные пересчитаются пропорционально.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {scaled.steps.length > 0 && (
          <button
            onClick={() => setCooking(true)}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            ▶ Готовить пошагово
          </button>
        )}
        <ShareButton title={recipe.title} getText={() => recipeToText(recipe, factor)} />
      </div>

      <IngredientList groups={recipe.groups} factor={factor} editable onSetFactor={setFactor} />
      <RecipeSteps steps={scaled.steps} stepImages={stepImages} onStepPhoto={uploadStep} />
      <RecipeTips tips={recipe.tips} />

      <RecipeQA recipeId={recipe.id} />

      {cooking && (
        <CookMode steps={scaled.steps} title={recipe.title} onExit={() => setCooking(false)} />
      )}
    </div>
  );
}
