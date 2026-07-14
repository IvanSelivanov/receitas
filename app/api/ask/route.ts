import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/recipe/db';
import { recipeToText } from '@/lib/recipe/shareText';
import { askAboutRecipe, type QAPair } from '@/lib/gemini/ask';

// Rate-limit: простой in-memory на инстанс (как в /api/generate). Отдельное окно
// под вопросы — они дешевле и их задают чаще.
const WINDOW_MS = 60 * 60 * 1000; // 1 час
const MAX_PER_WINDOW = 40;
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

const MAX_Q = 500;
const MAX_HISTORY = 6; // сколько прошлых пар Q&A передаём как контекст
const MAX_A = 4000; // обрезаем длинные ответы в истории, чтобы не раздувать токены

// Достаёт из тела запроса корректную историю диалога (массив {q,a}-строк).
function parseHistory(raw: unknown): QAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is QAPair =>
        !!x && typeof x === 'object' && typeof (x as QAPair).q === 'string' && typeof (x as QAPair).a === 'string',
    )
    .slice(-MAX_HISTORY)
    .map((x) => ({ q: x.q.slice(0, MAX_Q), a: x.a.slice(0, MAX_A) }));
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => ({}))) as {
    recipeId?: unknown;
    question?: unknown;
    history?: unknown;
  };
  const recipeId = typeof body.recipeId === 'string' ? body.recipeId : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const history = parseHistory(body.history);

  if (!recipeId || !question) {
    return NextResponse.json({ error: 'Пустой вопрос' }, { status: 400 });
  }
  if (question.length > MAX_Q) {
    return NextResponse.json({ error: 'Вопрос слишком длинный' }, { status: 400 });
  }

  // RLS отдаёт рецепт только его владельцу — чужой id вернёт null.
  const recipe = await getRecipe(supabase, recipeId);
  if (!recipe) {
    return NextResponse.json({ error: 'Рецепт не найден' }, { status: 404 });
  }

  const result = await askAboutRecipe(recipeToText(recipe), question, history);
  return NextResponse.json(result);
}
