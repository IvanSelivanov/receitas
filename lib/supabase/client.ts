import { createBrowserClient } from '@supabase/ssr';

// Клиент для браузера (Client Components). Publishable-ключ безопасен на клиенте
// при включённом RLS (см. supabase/schema.sql).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
