'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Строка из localStorage как внешний стор (useSyncExternalStore), а не
// «прочитать в useEffect и положить в стейт»: без лишнего рендера и без
// рассинхрона при гидрации — на сервере и при гидрации значение null,
// сразу после неё React перечитывает реальное.
//
// Запись дублируется в память: если localStorage недоступен (приватный режим,
// квота), UI всё равно обновится — просто не переживёт перезагрузку.

const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();

function subscribe(onChange: () => void) {
  // Изменения из других вкладок: сбрасываем память, чтобы прочитать свежее.
  const onStorage = (e: StorageEvent) => {
    if (e.key) memory.delete(e.key);
    else memory.clear();
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function read(key: string | null): string | null {
  if (!key) return null;
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const serverSnapshot = () => null;

export function useLocalStorage(
  key: string | null,
): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), serverSnapshot);

  const set = useCallback(
    (next: string | null) => {
      if (!key) return;
      memory.set(key, next);
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        /* приватный режим / квота — остаётся в памяти */
      }
      listeners.forEach((l) => l());
    },
    [key],
  );

  return [value, set];
}
