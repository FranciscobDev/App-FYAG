import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-(--radius-card) border border-ink-200/70 bg-surface shadow-(--shadow-card)", className)}
      {...rest}
    />
  );
}

/** Se mantiene aquí por compatibilidad; la implementación vive en components/shared. */
export { PageHeader } from "@/components/shared/PageHeader";
