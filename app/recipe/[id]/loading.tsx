// Скелетон страницы рецепта на время загрузки данных.
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-3 h-8 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-5 flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-900" />
        ))}
      </div>
      <div className="mb-5 h-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
        ))}
      </div>
    </main>
  );
}
