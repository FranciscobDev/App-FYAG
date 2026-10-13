import { Navigate, Outlet, Route, Routes } from "react-router";
import { ComingSoonPage } from "@/components/ComingSoonPage";
import { ROLES } from "@/core/roles";
import type { Role } from "@/core/types";
import { AdminDashboardPage } from "@/features/admin/AdminDashboardPage";
import { DesignSystemPage } from "@/features/design-system/DesignSystemPage";
import { useAuth } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { RoleSelectPage } from "@/features/auth/RoleSelectPage";
import { TechnicianHomePage } from "@/features/technician/TechnicianHomePage";
import { TechnicianProfilePage } from "@/features/technician/TechnicianProfilePage";
import { WarehouseHomePage } from "@/features/warehouse/WarehouseHomePage";
import { DispatchPage, InventoryPage, RequestsPage } from "@/features/inventory";
import { PurchaseOrdersPage, ReceivingPage, ThirdPartiesPage } from "@/features/purchasing";
import { ProjectsPage } from "@/features/projects";
import { AdminLayout } from "@/layouts/AdminLayout";
import { TechnicianLayout } from "@/layouts/TechnicianLayout";
import { WarehouseLayout } from "@/layouts/WarehouseLayout";

/** Protege un grupo de rutas: solo entra el rol indicado. */
function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={ROLES[user.role].basePath} replace />;
  return <Outlet />;
}

/** Rutas "Próximamente" generadas desde la navegación del rol. */
const pending = (role: Role, implemented: string[]) =>
  ROLES[role].nav
    .filter((n) => n.to !== "" && !implemented.includes(n.to))
    .map((n) => <Route key={n.to} path={n.to} element={<ComingSoonPage title={n.label} />} />);

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ─── RUTAS PÚBLICAS Y AUTENTICACIÓN ─── */}
      <Route
        path="/"
        element={user ? <Navigate to={ROLES[user.role].basePath} replace /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to={ROLES[user.role].basePath} replace /> : <LoginPage />}
      />
      <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
      <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      <Route path="/selector-roles" element={<RoleSelectPage />} />
      <Route path="/sistema-diseno" element={<DesignSystemPage />} />

      {/* ─── RUTAS PROTEGIDAS: ADMINISTRADOR (Escritorio) ─── */}
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="inventario" element={<InventoryPage />} />
          <Route path="movimientos" element={<InventoryPage defaultTab="cardex" />} />
          <Route path="solicitudes" element={<RequestsPage />} />
          <Route path="ordenes-compra" element={<PurchaseOrdersPage />} />
          <Route path="proveedores" element={<ThirdPartiesPage />} />
          <Route path="recepciones" element={<ReceivingPage />} />
          <Route path="proyectos" element={<ProjectsPage />} />
          {pending("admin", [
            "inventario",
            "movimientos",
            "solicitudes",
            "ordenes-compra",
            "proveedores",
            "recepciones",
            "proyectos",
          ])}
        </Route>
      </Route>

      {/* ─── RUTAS PROTEGIDAS: BODEGUERO (Tablet) ─── */}
      <Route element={<RequireRole role="warehouse" />}>
        <Route path="/bodega" element={<WarehouseLayout />}>
          <Route index element={<WarehouseHomePage />} />
          <Route path="inventario" element={<InventoryPage />} />
          <Route path="solicitudes" element={<RequestsPage />} />
          <Route path="egreso" element={<DispatchPage />} />
          <Route path="recepcion" element={<ReceivingPage />} />
          <Route path="conteo" element={<InventoryPage defaultTab="conteo" />} />
          {pending("warehouse", ["inventario", "solicitudes", "egreso", "recepcion", "conteo"])}
        </Route>
      </Route>

      {/* ─── RUTAS PROTEGIDAS: TÉCNICO (Celular) ─── */}
      <Route element={<RequireRole role="technician" />}>
        <Route path="/tecnico" element={<TechnicianLayout />}>
          <Route index element={<TechnicianHomePage />} />
          <Route path="perfil" element={<TechnicianProfilePage />} />
          {pending("technician", ["perfil"])}
        </Route>
      </Route>

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
