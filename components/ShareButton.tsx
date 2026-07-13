'use client';

import { useState } from 'react';

// Кнопка «Поделиться». На телефоне открывает системную шторку (Web Share API) —
// оттуда сразу доступны Telegram, WhatsApp и т.д. На десктопе, где share обычно
// нет, копирует текст в буфер и показывает подтверждение.
export function ShareButton({ title, getText }: { title: string; getText: () => string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = getText();
    // navigator.share есть не везде (в основном мобильные); проверяем в рантайме.
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, text });
      } catch {
        /* пользователь закрыл шторку — это не ошибка */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер недоступен (нет https / отказ в правах) — молча выходим */
    }
  }

  return (
    <button
      onClick={share}
      className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {copied ? 'Скопировано ✓' : '↗ Поделиться'}
    </button>
  );
}
