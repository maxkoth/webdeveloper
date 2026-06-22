// Streamed while the server runs the first scan. Mirrors the board's layout so
// the page doesn't jump when real rows swap in.

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-10">
        <div className="h-3 w-40 rounded bg-paper/10" />
        <div className="mt-8 h-3 w-32 rounded bg-paper/10" />
        <div className="mt-4 h-14 w-3/4 rounded bg-paper/10" />
      </div>

      <div className="h-10 border-b border-line" />

      <ul className="mt-8 flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="h-[72px] animate-pulse rounded-lg border border-line bg-ink-raised"
          />
        ))}
      </ul>

      <span className="sr-only">Loading today&apos;s setups…</span>
    </main>
  );
}
