import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/recipe/db';
import { RecipeView } from '@/components/RecipeView';
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

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Все рецепты
        </Link>
        <DeleteRecipeButton id={recipe.id} />
      </header>
      <h1 className="mb-5 text-2xl font-semibold">{recipe.title}</h1>
      <RecipeView recipe={recipe} userId={user.id} />
    </main>
  );
}
