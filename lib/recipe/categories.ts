import type { SupabaseClient } from '@supabase/supabase-js';

export interface Category {
  id: string;
  name: string;
}

/** Все категории пользователя (по алфавиту). */
export async function listCategories(sb: SupabaseClient): Promise<Category[]> {
  const { data, error } = await sb.from('categories').select('id, name').order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

/** Создаёт категорию. Возвращает созданную (или существующую при коллизии имени). */
export async function createCategory(
  sb: SupabaseClient,
  userId: string,
  name: string,
): Promise<Category> {
  const { data, error } = await sb
    .from('categories')
    .insert({ user_id: userId, name: name.trim() })
    .select('id, name')
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/** Категории, назначенные конкретному рецепту (id). */
export async function getRecipeCategoryIds(sb: SupabaseClient, recipeId: string): Promise<string[]> {
  const { data, error } = await sb
    .from('recipe_categories')
    .select('category_id')
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return (data ?? []).map((r) => r.category_id as string);
}

export async function assignCategory(
  sb: SupabaseClient,
  recipeId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await sb
    .from('recipe_categories')
    .insert({ recipe_id: recipeId, category_id: categoryId });
  if (error) throw error;
}

export async function unassignCategory(
  sb: SupabaseClient,
  recipeId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await sb
    .from('recipe_categories')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('category_id', categoryId);
  if (error) throw error;
}

/** Карта recipeId -> [categoryId] по всем связям пользователя (для фильтра списка). */
export async function getRecipeCategoryLinks(
  sb: SupabaseClient,
): Promise<Record<string, string[]>> {
  const { data, error } = await sb.from('recipe_categories').select('recipe_id, category_id');
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (map[row.recipe_id] ??= []).push(row.category_id as string);
  }
  return map;
}
