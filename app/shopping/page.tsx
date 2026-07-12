import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShoppingList } from '@/components/ShoppingList';

export default async function ShoppingPage() {
  // Auth-gate работает онлайн. Офлайн эту страницу отдаёт service worker из кэша
  // (серверный код не выполняется), а данные списка берутся из localStorage.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <ShoppingList />;
}
