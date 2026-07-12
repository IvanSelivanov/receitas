# Рецепты

Личное приложение для рецептов: генерируешь рецепт через Gemini (или импортируешь
по ссылке), сохраняешь, масштабируешь порции, добавляешь фото блюда и шагов.

## Настройка

Полная пошаговая инструкция «для чайников» — в **[SETUP.md](./SETUP.md)**:
где взять ключи Gemini и Supabase, какие SQL-скрипты и куда загрузить, как
запустить.

Коротко:

```bash
npm install
cp .env.local.example .env.local   # заполни ключи (см. SETUP.md)
npm run dev                        # http://localhost:3000
```

## Полезные команды

| Команда | Что делает |
|---|---|
| `npm run dev` | запуск в режиме разработки |
| `npm run build` | продакшн-сборка |
| `npm test` | юнит-тесты (детерминированные, без сети) |
| `npm run smoke` | проверка, что ключи Gemini/Supabase рабочие |
| `npm run eval` | eval извлечения рецептов на реальных примерах (`examples/`) |

## Стек

Next.js (App Router) · TypeScript · Supabase (БД + Auth + Storage) ·
Google Gemini (`@google/genai`) · Tailwind CSS.
