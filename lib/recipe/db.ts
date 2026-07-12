import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredRecipe, StoredGroup, StoredStep } from '../schema';

// Рецепт как он лежит в БД (jsonb-документ, см. решение Eng Review).
interface Row {
  id: string;
  title: string;
  intro: string | null;
  servings: number | null;
  groups: StoredGroup[];
  steps: StoredStep[];
  tips: string[];
  image_url: string | null;
  last_opened_at: string | null;
  created_at: string;
}

export interface RecipeRecord extends StoredRecipe {
  id: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface RecipeListItem {
  id: string;
  title: string;
  imageUrl: string | null;
  createdAt: string;
  lastOpenedAt: string | null;
}

function rowToRecord(row: Row): RecipeRecord {
  return {
    id: row.id,
    title: row.title,
    intro: row.intro,
    servings: row.servings,
    groups: row.groups ?? [],
    steps: row.steps ?? [],
    tips: row.tips ?? [],
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };
}

/** Список рецептов текущего пользователя (RLS ограничивает выборку). */
export async function listRecipes(sb: SupabaseClient): Promise<RecipeListItem[]> {
  const first = await sb
    .from('recipes')
    .select('id, title, image_url, created_at, last_opened_at')
    .order('created_at', { ascending: false });

  let rows = first.data as Array<Record<string, unknown>> | null;
  // Колонки last_opened_at может ещё не быть (SQL не применён) — фолбэк без неё.
  if (first.error) {
    const res = await sb
      .from('recipes')
      .select('id, title, image_url, created_at')
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    rows = res.data as Array<Record<string, unknown>> | null;
  }

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    imageUrl: (r.image_url as string | null) ?? null,
    createdAt: r.created_at as string,
    lastOpenedAt: (r.last_opened_at as string | null | undefined) ?? null,
  }));
}

/** Отмечает рецепт как только что открытый (для сортировки «недавно открытые»). */
export async function touchRecipe(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb
    .from('recipes')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Один рецепт по id, либо null. */
export async function getRecipe(sb: SupabaseClient, id: string): Promise<RecipeRecord | null> {
  const { data, error } = await sb.from('recipes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToRecord(data as Row) : null;
}

/** Несколько рецептов по id (для списка покупок). RLS отдаёт только свои. */
export async function getRecipesByIds(sb: SupabaseClient, ids: string[]): Promise<RecipeRecord[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb.from('recipes').select('*').in('id', ids);
  if (error) throw error;
  return (data ?? []).map((row) => rowToRecord(row as Row));
}

/** Сохраняет выбранные рецепты текущего пользователя. Возвращает id новых строк. */
export async function saveRecipes(
  sb: SupabaseClient,
  userId: string,
  recipes: StoredRecipe[],
): Promise<string[]> {
  const rows = recipes.map((r) => ({
    user_id: userId,
    title: r.title,
    intro: r.intro,
    servings: r.servings,
    groups: r.groups,
    steps: r.steps,
    tips: r.tips,
  }));
  const { data, error } = await sb.from('recipes').insert(rows).select('id');
  if (error) throw error;
  return (data ?? []).map((d) => d.id as string);
}

/** Переименовывает рецепт. */
export async function setRecipeTitle(
  sb: SupabaseClient,
  recipeId: string,
  title: string,
): Promise<void> {
  const { error } = await sb.from('recipes').update({ title }).eq('id', recipeId);
  if (error) throw error;
}

/** Ставит главное фото рецепта. */
export async function setRecipeImage(sb: SupabaseClient, recipeId: string, url: string): Promise<void> {
  const { error } = await sb.from('recipes').update({ image_url: url }).eq('id', recipeId);
  if (error) throw error;
}

/** Ставит фото конкретного шага (обновляет steps jsonb целиком). */
export async function setStepImage(
  sb: SupabaseClient,
  recipeId: string,
  stepIndex: number,
  url: string,
): Promise<void> {
  const { data, error } = await sb.from('recipes').select('steps').eq('id', recipeId).single();
  if (error) throw error;
  const steps = ((data?.steps as StoredStep[]) ?? []).slice();
  if (!steps[stepIndex]) throw new Error('Шаг не найден');
  steps[stepIndex] = { ...steps[stepIndex], imageUrl: url };
  const { error: updErr } = await sb.from('recipes').update({ steps }).eq('id', recipeId);
  if (updErr) throw updErr;
}
