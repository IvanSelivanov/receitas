import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/recipe/db';
import { listCategories, getRecipeCategoryIds, type Category } from '@/lib/recipe/categories';
import { RecipeView } from '@/components/RecipeView';
import { RecipeCategories } from '@/components/RecipeCategories';
import { EditableTitle } from '@/components/EditableTitle';
import { RecordOpen } from '@/components/RecordOpen';
import { DeleteRecipeButton } from '@/components/DeleteRecipeButton';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const recipe = await getRecipe(supabase, id);
  if (!recipe) notFound();

  // Категории необязательны: не роняем страницу, если SQL ещё не применён.
  let categories: Category[] = [];
  let assigned: string[] = [];
  try {
    [categories, assigned] = await Promise.all([
      listCategories(supabase),
      getRecipeCategoryIds(supabase, recipe.id),
    ]);
  } catch {
    /* categories not set up yet */
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <RecordOpen recipeId={recipe.id} />
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Все рецепты
        </Link>
        <DeleteRecipeButton id={recipe.id} />
      </header>
      <div className="mb-3">
        <EditableTitle recipeId={recipe.id} initial={recipe.title} />
      </div>
      <div className="mb-5">
        <RecipeCategories recipeId={recipe.id} userId={user.id} all={categories} assigned={assigned} />
      </div>
      <RecipeView recipe={recipe} userId={user.id} />
    </main>
  );
}
