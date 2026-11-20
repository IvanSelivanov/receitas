import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Обмен кода из magic-link на сессию, затем редирект на главную.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Частые причины: ссылку из письма открыли в другом браузере (нет PKCE
    // code verifier — например, во встроенном браузере почтового приложения),
    // открыли повторно или её «прокликал» сканер почты.
    console.error('[auth] callback: exchange failed:', error.code ?? '', error.message);
  } else {
    // Без code: провайдер вернул ошибку (отмена входа в Google и т.п.).
    console.error(
      '[auth] callback: no code:',
      searchParams.get('error') ?? '',
      searchParams.get('error_description') ?? '',
    );
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
