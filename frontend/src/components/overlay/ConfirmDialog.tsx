import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" para acciones destructivas (anular, eliminar, rechazar). */
  tone?: "primary" | "danger";
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "primary", loading,
}: ConfirmDialogProps) {
  const Icon = tone === "danger" ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-50 text-brand-600"}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <p className="text-body text-ink-700">{description}</p>
      </div>
    </Modal>
  );
}
