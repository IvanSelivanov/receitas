import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRecipesByIds } from '@/lib/recipe/db';
import { buildShoppingList } from '@/lib/recipe/shoppingList';
import { ShoppingListView } from '@/components/ShoppingListView';

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idList = (ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const recipes = await getRecipesByIds(supabase, idList);
  const items = buildShoppingList(recipes);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-4">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Все рецепты
        </Link>
      </header>
      <h1 className="text-2xl font-semibold">Список покупок</h1>
      {recipes.length > 0 ? (
        <p className="mb-5 mt-1 text-sm text-neutral-500">
          Из {recipes.length} рецепт(ов): {recipes.map((r) => r.title).join(', ')}
        </p>
      ) : (
        <p className="mb-5 mt-1 text-sm text-neutral-500">Рецепты не выбраны.</p>
      )}
      <ShoppingListView items={items} />
    </main>
  );
}
