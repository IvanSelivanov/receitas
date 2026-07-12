'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { touchRecipe } from '@/lib/recipe/db';

// Отмечает открытие рецепта в БД (last_opened_at) — для сортировки «недавно
// открытые», синхронно между устройствами. RLS ограничивает своими рецептами.
export function RecordOpen({ recipeId }: { recipeId: string }) {
  useEffect(() => {
    const sb = createClient();
    touchRecipe(sb, recipeId).catch(() => {
      /* не критично */
    });
  }, [recipeId]);
  return null;
}
