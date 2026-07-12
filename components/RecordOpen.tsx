'use client';

import { useEffect } from 'react';

export const OPENED_KEY = 'recipe-opened';

// Фиксирует факт открытия рецепта в localStorage (для сортировки «недавно
// открытые»). Пер-устройство, без обращения к БД.
export function RecordOpen({ recipeId }: { recipeId: string }) {
  useEffect(() => {
    try {
      const map = JSON.parse(localStorage.getItem(OPENED_KEY) ?? '{}') as Record<string, number>;
      map[recipeId] = Date.now();
      localStorage.setItem(OPENED_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }, [recipeId]);
  return null;
}
