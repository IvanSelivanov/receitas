import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listRecipes } from '@/lib/recipe/db';
import { listCategories, getRecipeCategoryLinks, type Category } from '@/lib/recipe/categories';
import { RecipeList } from '@/components/RecipeList';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const recipes = await listRecipes(supabase);
  // Категории необязательны: если SQL ещё не применён (нет таблиц) — не роняем
  // страницу, просто не показываем фильтр.
  let categories: Category[] = [];
  let links: Record<string, string[]> = {};
  try {
    [categories, links] = await Promise.all([
      listCategories(supabase),
      getRecipeCategoryLinks(supabase),
    ]);
  } catch {
    /* categories not set up yet */
  }

  async function signOut() {
    'use server';
    const sb = await createClient();
    await sb.auth.signOut();
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Рецепты</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/generate"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            + Новый
          </Link>
          <form action={signOut}>
            <button className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Выйти
            </button>
          </form>
        </div>
      </header>

      {recipes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-neutral-500">Пока пусто.</p>
          <Link href="/generate" className="mt-2 inline-block text-sm underline">
            Сгенерировать первый рецепт
          </Link>
        </div>
      ) : (
        <RecipeList recipes={recipes} categories={categories} links={links} />
      )}
    </main>
  );
}
