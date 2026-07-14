import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecipe } from '@/lib/recipe/db';
import { recipeToText } from '@/lib/recipe/shareText';
import { askAboutRecipe } from '@/lib/gemini/ask';

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
  };
  const recipeId = typeof body.recipeId === 'string' ? body.recipeId : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';

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

  const result = await askAboutRecipe(recipeToText(recipe), question);
  return NextResponse.json(result);
}
