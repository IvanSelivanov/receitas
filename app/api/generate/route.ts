import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateRecipes } from '@/lib/gemini/generate';

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

  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json({ error: 'Пустой запрос' }, { status: 400 });
  }

  const result = await generateRecipes(prompt);
  // ok:false с raw (битый JSON) — тоже отдаём 200, чтобы UI показал сырой текст.
  return NextResponse.json(result, { status: result.error && !result.raw ? 502 : 200 });
}
