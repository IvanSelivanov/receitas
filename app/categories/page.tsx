import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listCategories, type Category } from '@/lib/recipe/categories';
import { CategoriesManager } from '@/components/CategoriesManager';

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let categories: Category[] = [];
  try {
    categories = await listCategories(supabase);
  } catch {
    /* categories not set up yet */
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-4">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Все рецепты
        </Link>
      </header>
      <h1 className="mb-1 text-2xl font-semibold">Категории</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Удаление снимает метку со всех рецептов, сами рецепты остаются.
      </p>
      <CategoriesManager userId={user.id} initial={categories} />
    </main>
  );
}
