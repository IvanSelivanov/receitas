'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setRecipeTitle } from '@/lib/recipe/db';

// Кликабельно-редактируемое название рецепта. Тап -> поле; сохранение по Enter
// или потере фокуса; Escape отменяет.
export function EditableTitle({ recipeId, initial }: { recipeId: string; initial: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);

  async function save() {
    setEditing(false);
    const t = draft.trim();
    if (!t || t === title) {
      setDraft(title);
      return;
    }
    const prev = title;
    setTitle(t);
    try {
      await setRecipeTitle(supabase, recipeId, t);
    } catch {
      setTitle(prev);
      setDraft(prev);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-2xl font-semibold outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
      />
    );
  }

  return (
    <h1
      onClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      title="Нажми, чтобы переименовать"
      className="group cursor-text text-2xl font-semibold"
    >
      {title}
      <span className="ml-2 align-middle text-sm text-neutral-300 group-hover:text-neutral-500">
        ✎
      </span>
    </h1>
  );
}
