'use client';

import { useEffect } from 'react';

// Регистрирует service worker (только в проде — в dev мешает HMR).
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* офлайн-режим просто не включится, приложение работает как обычно */
    });
  }, []);
  return null;
}
