// Скелетон при навигации (App Router показывает его мгновенно, пока грузятся
// данные серверного компонента). Фолбэк для главной и прочих сегментов.
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 h-8 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-4 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-900" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />
        ))}
      </div>
    </main>
  );
}
