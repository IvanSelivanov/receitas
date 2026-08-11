-- КБЖУ рецепта. Применить в Supabase → SQL Editor → New query → Run.
--
-- Хранится оценка на ВСЁ блюдо целиком + вес готового блюда:
--   { "total": { "kcal": 2400, "protein": 90, "fat": 120, "carbs": 210 },
--     "totalWeightG": 1200, "servings": 4, "note": null,
--     "computedAt": "2026-08-11T10:00:00.000Z" }
-- «На порцию» и «на 100 г» приложение считает само (lib/recipe/nutrition.ts),
-- поэтому в БД лежит один непротиворечивый набор чисел.
--
-- null означает «ещё не считали» — в интерфейсе появляется кнопка «Рассчитать».
-- Отдельная политика RLS не нужна: колонка живёт внутри public.recipes.

alter table public.recipes add column if not exists nutrition jsonb;
