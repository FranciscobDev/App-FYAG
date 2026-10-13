import { useState } from "react";
import { CloudCheck, CloudOff, HardHat, LogOut, Phone, ShieldCheck, User as UserIcon, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/overlay/ConfirmDialog";
import { useAuth } from "@/features/auth/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { TECHNICIANS } from "@/data/mock";

export function TechnicianProfilePage() {
  const { user, signOut } = useAuth();
  const online = useOnlineStatus();
  const [showConfirm, setShowConfirm] = useState(false);

  // Buscar datos ampliados del técnico en mock
  const techData = TECHNICIANS.find((t) => t.rut === user?.rut) ?? {
    rut: user?.rut ?? "17.894.562-4",
    name: user?.name ?? "Alejandro Rojas Pino",
    phone: "+56 9 8123 4567",
    specialty: "Electricidad SEC clase A",
  };

  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Mi Perfil</h1>
        <p className="text-sm text-ink-500">Datos personales y configuración de sesión</p>
      </header>

      {/* Tarjeta de identidad del técnico */}
      <Card className="p-5 text-center">
        <div className="mx-auto mb-3 grid size-18 place-items-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700 shadow-inner">
          {user?.initials ?? "AR"}
        </div>
        <h2 className="text-lg font-bold text-ink-900">{techData.name}</h2>
        <p className="font-mono text-sm font-medium text-ink-500">{techData.rut}</p>
        <div className="mt-2 flex justify-center gap-2">
          <Badge tone="info">
            <HardHat size={13} aria-hidden="true" />
            Técnico en terreno
          </Badge>
          <Badge tone={online ? "ok" : "warn"}>
            {online ? <Wifi size={13} aria-hidden="true" /> : <CloudOff size={13} aria-hidden="true" />}
            {online ? "En línea" : "Modo local"}
          </Badge>
        </div>
      </Card>

      {/* Información de contacto y certificación */}
      <Card className="divide-y divide-ink-100 p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <ShieldCheck size={20} className="text-brand-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">Especialidad y certificación</p>
            <p className="text-sm font-semibold text-ink-900">{techData.specialty}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Phone size={20} className="text-brand-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">Teléfono de contacto</p>
            <p className="text-sm font-semibold text-ink-900">{techData.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <UserIcon size={20} className="text-brand-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">Rol asignado en el sistema</p>
            <p className="text-sm font-semibold text-ink-900">Operaciones en terreno / Reportes móviles</p>
          </div>
        </div>
      </Card>

      {/* Estado del almacenamiento offline */}
      <Card className="p-4 bg-brand-50/50 border-brand-100">
        <div className="flex items-start gap-3">
          <CloudCheck size={20} className="text-brand-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-brand-900">Almacenamiento sin conexión activo</p>
            <p className="text-xs text-ink-700 mt-0.5">
              Tus reportes y hojas de asistencia se guardan de forma segura en este celular y se sincronizan al detectar red.
            </p>
          </div>
        </div>
      </Card>

      {/* Zona de salida de sesión */}
      <Card className="p-4 border-danger-line/40 bg-danger-soft/10">
        <h3 className="text-sm font-bold text-ink-900 mb-1">Sesión activa</h3>
        <p className="text-xs text-ink-500 mb-4">
          Si vas a entregar el dispositivo a otro técnico o terminaste tu turno, cierra tu sesión aquí.
        </p>
        <Button
          variant="danger"
          size="lg"
          fullWidth
          icon={<LogOut size={20} aria-hidden="true" />}
          onClick={() => setShowConfirm(true)}
        >
          Cerrar sesión
        </Button>
      </Card>

      {/* Diálogo de confirmación accesible */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={signOut}
        tone="danger"
        title="¿Deseas cerrar tu sesión?"
        description={
          online
            ? "¿Estás seguro de que quieres salir? Tendrás que volver a autenticarte para registrar obras e informes."
            : "Estás sin conexión. Tus datos locales se conservarán en este equipo, pero necesitarás iniciar sesión nuevamente."
        }
        confirmLabel="Sí, cerrar sesión"
        cancelLabel="Volver"
      />
    </div>
  );
}
