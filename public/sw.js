// Service worker: network-first с фолбэком на кэш. Даёт офлайн-доступ к
// оболочке приложения и ассетам (в первую очередь для списка покупок).
// Данные списка и отметки живут в localStorage (см. ShoppingList).
const CACHE = 'receitas-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Только свой origin: запросы к Supabase/Gemini не трогаем (они всегда в сеть).
  if (url.origin !== self.location.origin) return;
  // API и auth не кэшируем — они требуют живого сервера.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  const isNav = req.mode === 'navigate';

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        // Офлайн: для навигаций игнорируем query (оболочка одинаковая для любых ids).
        const cached = await caches.match(req, { ignoreSearch: isNav });
        if (cached) return cached;
        if (isNav) {
          const home = await caches.match('/', { ignoreSearch: true });
          if (home) return home;
        }
        return Response.error();
      }
    })(),
  );
});
