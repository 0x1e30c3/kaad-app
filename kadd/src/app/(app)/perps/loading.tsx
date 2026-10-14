/** Shown at once while a Perps tab (Trade · Risk · Compare) renders on the server, so a tab click never looks stuck. */
export default function Loading() {
  return (
    <div className="p-3 md:p-5 flex flex-col gap-4" aria-busy aria-label="Loading">
      <div className="h-9 w-[260px] rounded-lg bg-raised animate-pulse" />
      <div className="h-12 w-full max-w-[520px] rounded-lg bg-raised animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg bg-raised animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-raised animate-pulse" />
    </div>
  );
}
