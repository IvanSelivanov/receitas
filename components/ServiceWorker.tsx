'use client';

import { useEffect } from 'react';

// В проде — регистрирует service worker (офлайн). В деве/локально — наоборот,
// убирает возможный залётный SW и его кэш (например, оставшийся от локального
// прод-билда), иначе он отдаёт устаревшие страницы и ломает вход (бесконечная
// перезагрузка после логина).
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* офлайн-режим просто не включится, приложение работает как обычно */
    });
  }, []);
  return null;
}
