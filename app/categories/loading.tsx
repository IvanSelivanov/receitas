// Скелетон страницы категорий.
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-5 h-8 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-4 h-9 w-full animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        ))}
      </div>
    </main>
  );
}
