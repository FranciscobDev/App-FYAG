import { useState } from "react";
import { Combobox } from "@/components/form/Combobox";
import { Checkbox, RadioGroup } from "@/components/form/Checkbox";
import type { DateRange } from "@/components/form/Calendar";
import { DatePicker, DateRangePicker } from "@/components/form/DatePicker";
import { FileUpload } from "@/components/form/FileUpload";
import { Input, NumberInput, PasswordInput, SearchInput } from "@/components/form/Input";
import { Select, Textarea } from "@/components/form/Select";
import { StarRating } from "@/components/form/StarRating";
import { Switch } from "@/components/form/Switch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PRODUCTS, PROJECTS } from "@/data/mock";
import { Section } from "./FoundationsTab";

export function FormsTab() {
  const [rut, setRut] = useState("12.456.789-5");
  const [qty, setQty] = useState<number | null>(12.5);
  const [search, setSearch] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>("2026-10-12");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [files, setFiles] = useState<File[]>([]);
  const [rating, setRating] = useState(4);
  const [kind, setKind] = useState<string | null>("obra");
  const [agree, setAgree] = useState(true);
  const [notify, setNotify] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <>
      <Section title="Texto y números">
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="RUT del técnico" required value={rut} onChange={(e) => setRut(e.target.value)} hint="Formato 12.345.678-5" />
          <Input label="SKU" placeholder="ELE-CBL-0012" hint="Se completa al escanear el código" />
          <NumberInput label="Cantidad entregada" value={qty} onValueChange={setQty} unit="kg" min={0} hint="Hasta 3 decimales · usa coma (12,5)" />
          <NumberInput label="Largo" value={-3} onValueChange={() => {}} unit="m" error="El largo debe ser mayor que cero." />
          <PasswordInput label="Contraseña" required hint="Mínimo 8 caracteres" />
          <SearchInput value={search} onValueChange={setSearch} placeholder="Buscar producto o SKU…" />
          <div className="sm:col-span-2">
            <Textarea label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="Describe el estado de los materiales entregados" />
          </div>
        </Card>
      </Section>

      <Section title="Selección">
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Select label="Categoría" defaultValue="">
            <option value="" disabled>Selecciona una categoría</option>
            {[...new Set(PRODUCTS.map((p) => p.category))].map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Combobox
            label="Proyecto"
            required
            value={project}
            onChange={setProject}
            options={PROJECTS.map((p) => ({ value: p.id, label: p.name, description: `${p.code} · ${p.client}` }))}
          />
          <RadioGroup
            legend="Tipo de proyecto"
            value={kind}
            onChange={setKind}
            options={[
              { value: "obra", label: "Obra", description: "Construcción e instalación" },
              { value: "mantencion", label: "Mantención", description: "Preventiva o correctiva" },
            ]}
          />
          <div>
            <Checkbox label="Notificarme por correo" description="Recibirás un aviso cuando cambie el estado." checked={agree} onCheckedChange={setAgree} />
            <Switch label="Modo sin conexión" description="Guarda cambios en el equipo" checked={notify} onCheckedChange={setNotify} />
          </div>
        </Card>
      </Section>

      <Section title="Fechas, archivos y calificación">
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <DatePicker label="Fecha de entrega" value={date} onChange={setDate} />
          <DateRangePicker label="Período del informe" value={range} onChange={setRange} />
          <div className="sm:col-span-2">
            <FileUpload label="Fotos del trabajo" hint="Puedes tomar la foto con la cámara en celular y tablet" files={files} onFilesChange={setFiles} accept="image/*,.pdf" multiple maxSizeMB={8} />
          </div>
          <StarRating label="Calificación del servicio" value={rating} onChange={setRating} />
          <div>
            <p className="mb-1 text-label font-semibold">Solo lectura</p>
            <StarRating label="Calificación promedio" value={3} readOnly />
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <Button>Guardar</Button>
            <Button variant="secondary">Cancelar</Button>
          </div>
        </Card>
      </Section>
    </>
  );
}
