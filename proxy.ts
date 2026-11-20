import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Обновляет сессию Supabase на каждый запрос (иначе токен протухает и
// проверка сессии на сервере возвращает null). Паттерн из доки @supabase/ssr.
// В Next 16 это "proxy" (бывший middleware).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims, а не getUser: подпись JWT проверяется локально по JWKS, без
  // запроса в Supabase Auth на каждый запрос (их тут десятки — страницы,
  // RSC-префетчи, API). Протухший токен getClaims обновит так же, как getUser.
  const { data, error } = await supabase.auth.getClaims();

  // Уже вошёл, а открыл /login — сразу на главную. Ярлык на главном экране
  // Android (у сайта нет манифеста) открывает ту страницу, с которой его
  // добавили; добавленный со страницы входа каждый раз показывал форму,
  // хотя сессия жива. Куки обновлённой сессии переносим в редирект.
  if (data?.claims.sub && request.nextUrl.pathname === '/login') {
    const redirect = NextResponse.redirect(new URL('/', request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  // «Нет сессии» — норма для /login. Остальное (например, refresh token уже
  // использован — сессию отозвали) пишем в лог: это и есть «слетела авторизация».
  if (error && error.name !== 'AuthSessionMissingError') {
    console.warn('[auth] proxy:', error.name, error.code ?? '', error.message, request.nextUrl.pathname);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
