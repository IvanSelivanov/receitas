import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Клиент для серверного кода (Server Components, Route Handlers). Читает и пишет
// сессию через cookies. В Next 16 cookies() асинхронный.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // В Server Components запись cookie может быть запрещена — middleware
          // обновляет сессию, поэтому здесь ошибку глотаем.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* noop */
          }
        },
      },
    },
  );
}

// Id текущего пользователя или null. getClaims() проверяет подпись JWT локально
// по JWKS проекта (ключи асимметричные, JWKS кэшируется в памяти на 10 минут),
// а getUser() на каждый вызов ходил в Supabase Auth по сети. Если токен
// протух, getClaims сам обновит сессию (как и getUser).
export async function getUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
