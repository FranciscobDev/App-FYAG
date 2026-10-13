import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";
import { Drawer, Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { Input } from "@/components/form/Input";
import { Section } from "./FoundationsTab";

export function FeedbackTab() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const fakeSave = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); toast({ tone: "ok", title: "Cambios guardados" }); }, 1500);
  };

  const anular = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setConfirm(false);
      toast({ tone: "danger", title: "Solicitud anulada", description: "SOL-2026-0412 quedó en estado Anulada." });
    }, 1200);
  };

  return (
    <>
      <Section title="Modal, Drawer y ConfirmDialog">
        <Card className="flex flex-wrap gap-3 p-5">
          <Button onClick={() => setModal(true)}>Abrir modal</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Abrir panel lateral</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>Anular solicitud…</Button>
          <Button loading={loading} loadingText="Guardando…" onClick={fakeSave}>Guardar con carga</Button>
        </Card>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Nueva solicitud de bodega"
          description="Completa los datos para solicitar materiales."
          footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={() => { setModal(false); toast({ tone: "ok", title: "Solicitud enviada" }); }}>Enviar</Button></>}
        >
          <div className="space-y-4">
            <Input label="Proyecto" defaultValue="OB-2026-014" />
            <Input label="SKU" placeholder="ELE-DIS-0016" />
          </div>
        </Modal>
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Detalle del producto"
          description="ELE-CBL-0012"
          footer={<Button onClick={() => setDrawer(false)}>Listo</Button>}
        >
          <p className="text-body-sm text-ink-700">Cable THHN 12 AWG rollo 100 m. Ubicación A-01-03.</p>
        </Drawer>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={anular}
          loading={busy}
          tone="danger"
          title="¿Anular la solicitud?"
          description="Esta acción no se puede deshacer. El stock comprometido volverá a estar disponible."
          confirmLabel="Sí, anular"
        />
      </Section>

      <Section title="Toast">
        <Card className="flex flex-wrap gap-3 p-5">
          <Button variant="secondary" onClick={() => toast({ tone: "ok", title: "Entrega registrada", description: "12 disyuntores a OB-2026-014." })}>Éxito</Button>
          <Button variant="secondary" onClick={() => toast({ tone: "warn", title: "Stock bajo", description: "Gas R410A bajo el mínimo." })}>Advertencia</Button>
          <Button variant="secondary" onClick={() => toast({ tone: "danger", title: "No se pudo enviar", description: "Se reintentará automáticamente." })}>Error</Button>
          <Button variant="secondary" onClick={() => toast({ tone: "info", title: "Sincronizando 3 registros" })}>Info</Button>
        </Card>
      </Section>

      <Section title="Tabs">
        <Card className="p-5">
          <Tabs
            label="Solicitudes por estado"
            tabs={[
              { id: "pend", label: "Pendientes", count: 3, content: <p className="text-body-sm">3 solicitudes esperan aprobación.</p> },
              { id: "apr", label: "Aprobadas", count: 12, content: <p className="text-body-sm">12 solicitudes aprobadas este mes.</p> },
              { id: "rech", label: "Rechazadas", count: 1, content: <p className="text-body-sm">1 solicitud rechazada.</p> },
            ]}
          />
        </Card>
      </Section>

      <Section title="Skeleton">
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <Card className="space-y-3 p-4">
            <Skeleton className="h-6 w-1/3" />
            <SkeletonText lines={4} />
          </Card>
        </div>
      </Section>
    </>
  );
}
