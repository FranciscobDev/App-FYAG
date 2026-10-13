import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
/** md: 40 px escritorio / 44 px táctil · lg: 56 px · xl: 64 px */
type Size = "md" | "lg" | "xl";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Muestra spinner, bloquea clics y anuncia "ocupado" a lectores de pantalla. */
  loading?: boolean;
  loadingText?: string;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink-900 border border-ink-500 hover:bg-ink-100",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-danger text-white hover:brightness-90",
};

const sizes: Record<Size, string> = {
  md: "min-h-10 pointer-coarse:min-h-touch px-4 text-body-sm pointer-coarse:text-body rounded-xl",
  lg: "min-h-14 px-6 text-body rounded-2xl",
  xl: "min-h-16 px-8 text-h3 rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  loading,
  loadingText,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

/** Botón solo-ícono: siempre 44 px mínimo y con nombre accesible obligatorio. */
export function IconButton({
  label,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-11 shrink-0 place-items-center rounded-xl text-ink-700 transition hover:bg-ink-100 disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
