import { FileText, ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { FormField, useFieldIds, type FieldProps } from "./FormField";

interface FileUploadProps extends FieldProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string; // ej. "image/*,.pdf"
  multiple?: boolean;
  maxSizeMB?: number;
  capture?: "environment" | "user"; // abre la cámara en celular/tablet
}

const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(b / 1e3)} KB`);

/** Carga de archivos con arrastrar-y-soltar, validación y vista previa de imágenes. */
export function FileUpload({
  files, onFilesChange, accept, multiple, maxSizeMB = 10, capture, ...field
}: FileUploadProps) {
  const ids = useFieldIds();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string>();

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > maxSizeMB * 1e6);
    setProblem(tooBig.length ? `${tooBig.map((f) => f.name).join(", ")} supera${tooBig.length > 1 ? "n" : ""} el máximo de ${maxSizeMB} MB.` : undefined);
    const ok = incoming.filter((f) => f.size <= maxSizeMB * 1e6);
    onFilesChange(multiple ? [...files, ...ok] : ok.slice(0, 1));
  };

  return (
    <FormField ids={ids} {...field} error={field.error ?? problem}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition",
          dragging ? "border-brand-600 bg-brand-50" : "border-ink-500 bg-white",
        )}
      >
        <UploadCloud className="text-brand-600" size={28} aria-hidden="true" />
        <p className="text-body-sm text-ink-700">
          Arrastra archivos aquí o{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center font-semibold text-brand-600 underline underline-offset-2"
          >
            selecciónalos
          </button>
        </p>
        <p className="text-caption text-ink-500">Máximo {maxSizeMB} MB por archivo{accept ? ` · ${accept.replace(/,/g, ", ")}` : ""}</p>
        <input
          ref={inputRef}
          id={ids.id}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          capture={capture}
          aria-describedby={field.hint ? ids.hintId : undefined}
          onChange={(e) => { add(e.target.files); e.target.value = ""; }}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Archivos seleccionados">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-2">
              {previews[i] ? (
                <img src={previews[i]!} alt={`Vista previa de ${f.name}`} className="size-14 rounded-lg object-cover" />
              ) : (
                <span className="grid size-14 place-items-center rounded-lg bg-ink-100 text-ink-700">
                  {f.type.startsWith("image/") ? <ImageIcon size={22} /> : <FileText size={22} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium">{f.name}</span>
                <span className="block text-caption text-ink-500">{size(f.size)}</span>
              </span>
              <IconButton label={`Quitar ${f.name}`} onClick={() => onFilesChange(files.filter((_, j) => j !== i))}>
                <Trash2 size={18} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </FormField>
  );
}
