// Скелетон главной. Шапка — настоящая (без интерактива), чтобы при запуске
// с ярлыка приложение выглядело готовым, как только пришёл первый байт HTML,
// пока сервер достаёт рецепты. Плашки — заметные и в тёмной теме: раньше
// neutral-900 на фоне #0a0a0a сливался в «чёрный экран».
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-6" aria-busy="true">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Рецепты</h1>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white opacity-60 dark:bg-white dark:text-neutral-900">
            + Новый
          </span>
          <span className="text-sm text-neutral-500">Выйти</span>
        </div>
      </header>
      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
      <div className="mb-3 h-9 animate-pulse rounded-lg border border-neutral-200 dark:border-neutral-800" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="size-4 shrink-0 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div
              className="h-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"
              style={{ width: `${45 + ((i * 37) % 40)}%` }}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
