import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateRecipes, type Media } from '@/lib/gemini/generate';

// Лимит на base64 файла (~4 МБ), чтобы уложиться в лимит тела запроса Vercel.
const MAX_B64 = 4_000_000;

// Rate-limit: простой in-memory на инстанс (решение Eng Review — «простой лимит»).
// Для личного приложения этого достаточно; при масштабировании заменить на
// KV/Redis. Защищает от случайного цикла ретраев в UI и чужих вызовов.
const WINDOW_MS = 60 * 60 * 1000; // 1 час
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

export async function POST(request: NextRequest) {
  // Auth-gate: сессия проверяется на сервере ДО вызова Gemini.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ error: 'Слишком часто. Попробуй позже.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown; media?: unknown };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  let media: Media | undefined;
  if (body.media && typeof body.media === 'object') {
    const m = body.media as { mimeType?: unknown; dataB64?: unknown };
    if (typeof m.mimeType === 'string' && typeof m.dataB64 === 'string') {
      const allowed = m.mimeType.startsWith('image/') || m.mimeType === 'application/pdf';
      if (!allowed) {
        return NextResponse.json({ error: 'Неподдерживаемый тип файла' }, { status: 400 });
      }
      if (m.dataB64.length > MAX_B64) {
        return NextResponse.json({ error: 'Файл слишком большой (до ~3 МБ)' }, { status: 413 });
      }
      media = { mimeType: m.mimeType, dataB64: m.dataB64 };
    }
  }

  if (!prompt && !media) {
    return NextResponse.json({ error: 'Пустой запрос' }, { status: 400 });
  }

  const result = await generateRecipes(
    prompt ||
      'Определи, что в приложенном файле: если это рецепт (текст/скриншот/скан) — извлеки его точно; ' +
        'если фото готового блюда или продуктов — определи блюдо и предложи рецепт, как его приготовить.',
    media,
  );
  // Результат всегда «обработанный» (generateRecipes сам ловит ошибки Gemini),
  // поэтому отдаём 200 и полагаемся на data.ok в UI. Не-2xx (502) оставляем для
  // настоящих падений функции — так в мониторинге не тонут реальные сбои.
  return NextResponse.json(result);
}
