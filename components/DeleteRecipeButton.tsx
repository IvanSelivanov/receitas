'use client';

import { useState, useTransition } from 'react';
import { deleteRecipe } from '@/lib/recipe/actions';

// Кнопка удаления с инлайн-подтверждением (удаление необратимо).
export function DeleteRecipeButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-neutral-500 hover:text-red-600"
      >
        Удалить
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">Удалить?</span>
      <button
        disabled={pending}
        onClick={() => startTransition(() => deleteRecipe(id))}
        className="font-medium text-red-600 disabled:opacity-50"
      >
        {pending ? 'Удаляю…' : 'Да'}
      </button>
      <button
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-neutral-500 disabled:opacity-50"
      >
        Нет
      </button>
    </span>
  );
}
