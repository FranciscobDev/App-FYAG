import { cn } from "@/lib/utils";

/** Bloque de carga genérico (decorativo; el aviso para lectores va en SkeletonGroup). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-ink-200", className)} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div role="status" className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <span className="sr-only">Cargando…</span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
  );
}
