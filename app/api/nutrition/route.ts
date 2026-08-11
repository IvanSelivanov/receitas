import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecipe, setRecipeNutrition } from '@/lib/recipe/db';
import { recipeToText } from '@/lib/recipe/shareText';
import { estimateNutrition } from '@/lib/gemini/nutrition';

// Расчёт КБЖУ для сохранённого рецепта: рецепты, созданные до появления фичи,
// и пересчёт после правки состава. У новых рецептов КБЖУ приходит сразу из
// /api/generate — сюда они не ходят.

// Rate-limit: как в /api/ask, in-memory на инстанс. Расчёт вызывают редко —
// окно небольшое.
const WINDOW_MS = 60 * 60 * 1000; // 1 час
const MAX_PER_WINDOW = 30;
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

  const body = (await request.json().catch(() => ({}))) as { recipeId?: unknown };
  const recipeId = typeof body.recipeId === 'string' ? body.recipeId : '';
  if (!recipeId) {
    return NextResponse.json({ error: 'Не указан рецепт' }, { status: 400 });
  }

  // RLS отдаёт рецепт только владельцу — чужой id вернёт null.
  const recipe = await getRecipe(supabase, recipeId);
  if (!recipe) {
    return NextResponse.json({ error: 'Рецепт не найден' }, { status: 404 });
  }

  // Старую оценку в контекст не отдаём: иначе при пересчёте модель просто
  // повторяет прежние цифры вместо того, чтобы считать заново.
  const result = await estimateNutrition(
    recipeToText({ ...recipe, nutrition: null }),
    recipe.servings,
  );
  if (!result.ok) return NextResponse.json(result);

  // Сохраняем, чтобы не пересчитывать при каждом открытии. Если запись не
  // удалась (SQL не применён) — честно говорим об этом, цифры не показываем:
  // иначе они пропадут при перезагрузке и это выглядит как баг.
  try {
    await setRecipeNutrition(supabase, recipe.id, result.nutrition ?? null);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Не удалось сохранить расчёт',
    });
  }

  return NextResponse.json(result);
}
