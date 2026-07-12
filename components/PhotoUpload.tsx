'use client';
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';

// Переиспользуемый загрузчик фото. Сама логика (сжатие/upload/запись в БД) —
// в onSelect у родителя; компонент отвечает за превью, выбор файла и статусы.
export function PhotoUpload({
  current,
  onSelect,
  label,
  compact = false,
}: {
  current?: string | null;
  onSelect: (file: File) => Promise<void>;
  label: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      await onSelect(file);
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Не удалось загрузить');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {current && (
        <img
          src={current}
          alt=""
          className={`w-full rounded-lg object-cover ${compact ? 'max-h-48' : 'max-h-72'}`}
        />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`self-start rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 ${
          compact ? 'text-xs' : ''
        }`}
      >
        {busy ? 'Загружаю…' : current ? `Заменить ${label}` : `+ ${label}`}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleChange} />
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
