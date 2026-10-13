import { Keyboard, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/form/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlay/Modal";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** Se llama con el texto leído (QR o código de barras) y el modal se cierra. */
  onDetect: (code: string) => void;
  title?: string;
}

/** Vista de cámara. Vive dentro del Modal, así la cámara se apaga al cerrarlo. */
function ScannerView({ onDetect }: { onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [message, setMessage] = useState("Iniciando cámara…");
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        // Import dinámico: la librería solo se descarga cuando se usa el escáner.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, c) => {
          if (result && !cancelled) {
            cancelled = true;
            c.stop();
            onDetect(result.getText());
          }
        });
        stop = () => controls.stop();
        if (cancelled) controls.stop();
        else {
          setStatus("scanning");
          setMessage("Apunta al código QR o de barras");
        }
      } catch (e) {
        setStatus("error");
        setShowManual(true);
        setMessage(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en el navegador o ingresa el código a mano."
            : "No se pudo usar la cámara. Ingresa el código manualmente.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink-900">
        <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Vista de la cámara" />
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-white/90 shadow-[0_0_0_999px_rgb(15_23_42/0.45)]" aria-hidden="true" />
        )}
        {status !== "scanning" && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-body-sm text-white">
            <ScanLine size={32} className="mb-2 inline" aria-hidden="true" /> {message}
          </p>
        )}
      </div>
      <p role="status" className="text-center text-body-sm text-ink-700">{status === "scanning" ? message : status === "error" ? message : ""}</p>

      {showManual ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); manual.trim() && onDetect(manual.trim()); }}
        >
          <div className="flex-1">
            <Input label="Código o SKU" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="ELE-CBL-0012" autoFocus />
          </div>
          <Button type="submit" disabled={!manual.trim()}>Buscar</Button>
        </form>
      ) : (
        <Button variant="secondary" fullWidth icon={<Keyboard size={18} />} onClick={() => setShowManual(true)}>
          Ingresar código manualmente
        </Button>
      )}
    </div>
  );
}

export function QrScannerModal({ open, onClose, onDetect, title = "Escanear código" }: QrScannerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description="QR o código de barras" size="sm">
      <ScannerView onDetect={(code) => { onDetect(code); onClose(); }} />
    </Modal>
  );
}
