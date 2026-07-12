'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Удаление рецепта. RLS (recipes_delete_own) гарантирует, что пользователь может
// удалить только свою строку — .eq('id') просто адресует конкретную.
export async function deleteRecipe(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/');
  redirect('/');
}
