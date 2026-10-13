import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Base sobre <dialog>: focus trap, Escape y restauración de foco nativos del navegador. */
function DialogShell({
  open, onClose, title, description, children, footer, className,
}: DialogProps & { className: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn("bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/50", className)}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-h2 font-bold">{title}</h2>
              {description && <p id={descId} className="mt-0.5 text-body-sm text-ink-500">{description}</p>}
            </div>
            <IconButton label="Cerrar" onClick={onClose}><X size={20} /></IconButton>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap justify-end gap-3 border-t border-ink-200 bg-ink-100/60 px-5 py-3">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  );
}

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

export function Modal({ size = "md", ...props }: DialogProps & { size?: keyof typeof SIZES }) {
  return (
    <DialogShell
      {...props}
      className={cn(
        "m-auto max-h-[88dvh] w-[calc(100%-2rem)] animate-pop rounded-2xl open:flex open:flex-col",
        SIZES[size],
      )}
    />
  );
}

/** Panel lateral (pantalla completa en celular). */
export function Drawer(props: DialogProps) {
  return (
    <DialogShell
      {...props}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md animate-slide-in sm:rounded-l-2xl open:flex open:flex-col"
    />
  );
}
