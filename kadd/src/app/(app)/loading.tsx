export default function Loading() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy aria-label="Loading">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-raised" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}
