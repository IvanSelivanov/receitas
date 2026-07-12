# TODOS

## Deferred (post-v1)
- [ ] **Оффлайн-чтение сохранённых рецептов** — кэшировать просмотренные рецепты
  через service worker для чтения без сети.
  - Why: PWA на кухне, слабый wifi; сейчас v1 требует сеть (данные в Supabase).
  - Depends on: базовый PWA (manifest + service worker) из v1.
  - Where to start: cache-first стратегия для GET рецептов + локальный слепок в
    IndexedDB; инвалидация при следующем онлайн-открытии.
