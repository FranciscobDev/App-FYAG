import {
  Ban,
  Building,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { isValidRut } from "@/core/format";
import type { Client, Supplier } from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { CLIENTS, SUPPLIERS } from "@/data/mock";

export function ThirdPartiesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const toast = useToast();

  const [activeTab, setActiveTab] = useState("proveedores");

  // Proveedores y Clientes
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS);
  const [clients, setClients] = useState<Client[]>(CLIENTS);

  // Búsqueda y Ordenamiento
  const [search, setSearch] = useState("");
  const [supplierSortBy, setSupplierSortBy] = useState<"rating_desc" | "rating_asc" | "name_asc">("rating_desc");

  // Modal Proveedor
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supRut, setSupRut] = useState("");
  const [supBusinessName, setSupBusinessName] = useState("");
  const [supTradeName, setSupTradeName] = useState("");
  const [supCategory, setSupCategory] = useState("Eléctrico");
  const [supPhone, setSupPhone] = useState("+56 2 ");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supContactName, setSupContactName] = useState("");
  const [supContactPhone, setSupContactPhone] = useState("+56 9 ");
  // Bancarios (Solo Admin)
  const [supBank, setSupBank] = useState("Banco de Chile");
  const [supAccountType, setSupAccountType] = useState<"corriente" | "vista" | "ahorro">("corriente");
  const [supAccountNumber, setSupAccountNumber] = useState("");
  const [supTransferEmail, setSupTransferEmail] = useState("");

  // Modal Cliente
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [cliRut, setCliRut] = useState("");
  const [cliBusinessName, setCliBusinessName] = useState("");
  const [cliCategory, setCliCategory] = useState("Inmobiliaria & Construcción");
  const [cliPhone, setCliPhone] = useState("+56 2 ");
  const [cliEmail, setCliEmail] = useState("");
  const [cliAddress, setCliAddress] = useState("");
  const [cliContactName, setCliContactName] = useState("");

  // Modal confirmación deshabilitar
  const [disablingEntity, setDisablingEntity] = useState<{ type: "supplier" | "client"; item: any } | null>(null);

  // ─── PROVEEDORES: FILTRADO Y ORDEN POR CALIFICACIÓN ───
  const filteredSuppliers = useMemo(() => {
    let list = suppliers.filter((s) => {
      const q = search.trim().toLowerCase();
      return (
        !q ||
        s.businessName.toLowerCase().includes(q) ||
        s.rut.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });

    if (supplierSortBy === "rating_desc") {
      list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    } else if (supplierSortBy === "rating_asc") {
      list = [...list].sort((a, b) => a.ratingAvg - b.ratingAvg);
    } else if (supplierSortBy === "name_asc") {
      list = [...list].sort((a, b) => a.businessName.localeCompare(b.businessName, "es-CL"));
    }

    return list;
  }, [suppliers, search, supplierSortBy]);

  // ─── CLIENTES: FILTRADO ───
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = search.trim().toLowerCase();
      return (
        !q ||
        c.businessName.toLowerCase().includes(q) ||
        c.rut.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [clients, search]);

  // Validaciones de RUT en formulario Proveedor
  const isSupRutValid = useMemo(() => {
    return !supRut.trim() || isValidRut(supRut.trim());
  }, [supRut]);

  const isSupRutDuplicate = useMemo(() => {
    if (!supRut.trim()) return false;
    const clean = supRut.trim().replace(/[.\s-]/g, "").toUpperCase();
    return suppliers.some(
      (s) =>
        s.id !== editingSupplier?.id &&
        s.rut.replace(/[.\s-]/g, "").toUpperCase() === clean,
    );
  }, [suppliers, supRut, editingSupplier]);

  // Validaciones de RUT en formulario Cliente
  const isCliRutValid = useMemo(() => {
    return !cliRut.trim() || isValidRut(cliRut.trim());
  }, [cliRut]);

  const isCliRutDuplicate = useMemo(() => {
    if (!cliRut.trim()) return false;
    const clean = cliRut.trim().replace(/[.\s-]/g, "").toUpperCase();
    return clients.some(
      (c) =>
        c.id !== editingClient?.id &&
        c.rut.replace(/[.\s-]/g, "").toUpperCase() === clean,
    );
  }, [clients, cliRut, editingClient]);

  // Guardar Proveedor
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut(supRut.trim())) {
      toast({ tone: "danger", title: "RUT inválido", description: "Verifica el dígito verificador del RUT." });
      return;
    }
    if (isSupRutDuplicate) {
      toast({ tone: "danger", title: "RUT duplicado", description: "Ya existe un proveedor con ese RUT." });
      return;
    }

    const newSup: Supplier = {
      id: editingSupplier ? editingSupplier.id : `sup-${Date.now()}`,
      rut: supRut.trim().toUpperCase(),
      businessName: supBusinessName.trim(),
      tradeName: supTradeName.trim() || supBusinessName.trim(),
      category: supCategory,
      phone: supPhone.trim(),
      email: supEmail.trim(),
      address: supAddress.trim(),
      contactName: supContactName.trim(),
      contactPhone: supContactPhone.trim(),
      bankDetails: {
        bank: supBank,
        accountType: supAccountType,
        accountNumber: supAccountNumber.trim() || "00-000-00000",
        transferEmail: supTransferEmail.trim() || supEmail.trim(),
      },
      ratingAvg: editingSupplier ? editingSupplier.ratingAvg : 5.0,
      ratingCount: editingSupplier ? editingSupplier.ratingCount : 1,
    };

    if (editingSupplier) {
      setSuppliers(suppliers.map((s) => (s.id === editingSupplier.id ? newSup : s)));
      toast({ tone: "ok", title: "Proveedor actualizado", description: `${newSup.businessName} guardado.` });
    } else {
      setSuppliers([newSup, ...suppliers]);
      toast({ tone: "ok", title: "Proveedor registrado", description: `${newSup.businessName} añadido.` });
    }

    setSupplierModalOpen(false);
  };

  // Guardar Cliente
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRut(cliRut.trim())) {
      toast({ tone: "danger", title: "RUT inválido", description: "Verifica el dígito verificador del RUT." });
      return;
    }
    if (isCliRutDuplicate) {
      toast({ tone: "danger", title: "RUT duplicado", description: "Ya existe un cliente con ese RUT." });
      return;
    }

    const newCli: Client = {
      id: editingClient ? editingClient.id : `cli-${Date.now()}`,
      rut: cliRut.trim().toUpperCase(),
      businessName: cliBusinessName.trim(),
      category: cliCategory,
      phone: cliPhone.trim(),
      email: cliEmail.trim(),
      address: cliAddress.trim(),
      contactName: cliContactName.trim(),
      activeProjectsCount: editingClient ? editingClient.activeProjectsCount : 0,
    };

    if (editingClient) {
      setClients(clients.map((c) => (c.id === editingClient.id ? newCli : c)));
      toast({ tone: "ok", title: "Cliente actualizado", description: `${newCli.businessName} guardado.` });
    } else {
      setClients([newCli, ...clients]);
      toast({ tone: "ok", title: "Cliente registrado", description: `${newCli.businessName} añadido.` });
    }

    setClientModalOpen(false);
  };

  // Deshabilitar en vez de eliminar
  const handleToggleDisable = () => {
    if (!disablingEntity) return;

    if (disablingEntity.type === "supplier") {
      const s = disablingEntity.item as Supplier;
      setSuppliers(
        suppliers.map((item) =>
          item.id === s.id ? { ...item, disabled: !item.disabled } : item,
        ),
      );
      toast({
        tone: s.disabled ? "ok" : "warn",
        title: s.disabled ? "Proveedor habilitado" : "Proveedor deshabilitado",
        description: s.disabled
          ? `${s.businessName} activo para nuevas compras.`
          : `${s.businessName} deshabilitado (se preserva historial).`,
      });
    } else {
      const c = disablingEntity.item as Client;
      setClients(
        clients.map((item) =>
          item.id === c.id ? { ...item, disabled: !item.disabled } : item,
        ),
      );
      toast({
        tone: c.disabled ? "ok" : "warn",
        title: c.disabled ? "Cliente habilitado" : "Cliente deshabilitado",
        description: c.disabled
          ? `${c.businessName} habilitado.`
          : `${c.businessName} deshabilitado (se preserva historial).`,
      });
    }

    setDisablingEntity(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directorio de Proveedores y Clientes"
        subtitle="Registro con validación de RUT chileno, datos bancarios protegidos y ranking de evaluación de proveedores"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "proveedores" ? (
              <Button
                onClick={() => {
                  setEditingSupplier(null);
                  setSupRut("");
                  setSupBusinessName("");
                  setSupTradeName("");
                  setSupCategory("Eléctrico");
                  setSupPhone("+56 2 ");
                  setSupEmail("");
                  setSupAddress("");
                  setSupContactName("");
                  setSupContactPhone("+56 9 ");
                  setSupAccountNumber("");
                  setSupTransferEmail("");
                  setSupplierModalOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Nuevo Proveedor</span>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditingClient(null);
                  setCliRut("");
                  setCliBusinessName("");
                  setCliCategory("Inmobiliaria & Construcción");
                  setCliPhone("+56 2 ");
                  setCliEmail("");
                  setCliAddress("");
                  setCliContactName("");
                  setClientModalOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Nuevo Cliente</span>
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        label="Directorio de Terceros"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: "proveedores",
            label: "Proveedores",
            content: (
              <div className="space-y-5">
                {/* ─── BARRA DE BÚSQUEDA Y ORDEN POR CALIFICACIÓN ─── */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar por RUT, razón social, rubro..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
                    />
                  </div>

                  {/* Selector de orden por calificación */}
                  <div className="flex items-center gap-2">
                    <label className="text-caption font-semibold text-ink-600">Ordenar por:</label>
                    <select
                      value={supplierSortBy}
                      onChange={(e) => setSupplierSortBy(e.target.value as any)}
                      className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm font-semibold text-ink-900 focus:border-brand-600 focus:outline-none"
                    >
                      <option value="rating_desc">⭐ Mejor calificación primero</option>
                      <option value="rating_asc">Menor calificación primero</option>
                      <option value="name_asc">Razón social A-Z</option>
                    </select>
                  </div>
                </div>

                {/* ─── LISTA DE PROVEEDORES ─── */}
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredSuppliers.map((s) => {
                    const isDisabled = Boolean(s.disabled);

                    return (
                      <Card
                        key={s.id}
                        className={`flex flex-col justify-between p-5 transition ${
                          isDisabled ? "opacity-60 bg-ink-50 border-ink-200" : "hover:border-brand-300"
                        }`}
                      >
                        <div>
                          {/* Cabecera: Razón social, RUT, Calificación */}
                          <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-body font-bold text-ink-900">{s.businessName}</h3>
                                {isDisabled && <Badge tone="mute">Deshabilitado</Badge>}
                              </div>
                              <span className="font-mono text-caption font-bold text-brand-700">{s.rut}</span>
                              <p className="text-caption text-ink-500">{s.category}</p>
                            </div>

                            {/* CALIFICACIÓN PROMEDIO */}
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1 text-body-sm font-black text-amber-600">
                                <Star size={16} className="fill-amber-400 text-amber-500" />
                                {s.ratingAvg.toFixed(1)}
                              </span>
                              <p className="mt-0.5 text-[11px] text-ink-500">
                                {s.ratingCount} {s.ratingCount === 1 ? "evaluación" : "evaluaciones"}
                              </p>
                            </div>
                          </div>

                          {/* Contacto y Dirección */}
                          <div className="mt-3 space-y-1 text-body-sm text-ink-700">
                            <p className="flex items-center gap-1.5 text-caption">
                              <MapPin size={14} className="text-ink-500 shrink-0" />
                              <span>{s.address}</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-caption">
                              <Phone size={14} className="text-ink-500 shrink-0" />
                              <span>{s.phone} · Contacto: <strong>{s.contactName}</strong></span>
                            </p>
                            <p className="flex items-center gap-1.5 text-caption">
                              <Mail size={14} className="text-ink-500 shrink-0" />
                              <span>{s.email}</span>
                            </p>
                          </div>

                          {/* ─── SECCIÓN DATOS BANCARIOS (VISIBLE SOLO ADMIN) ─── */}
                          <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
                            <div className="flex items-center justify-between text-caption font-bold text-ink-800 border-b border-ink-200/60 pb-1.5">
                              <span className="flex items-center gap-1.5">
                                <CreditCard size={15} className="text-brand-600" />
                                <span>Datos Bancarios para Pago:</span>
                              </span>
                              {isAdmin ? (
                                <Badge tone="ok">Confidencial Admin</Badge>
                              ) : (
                                <Badge tone="warn">Restringido</Badge>
                              )}
                            </div>

                            {isAdmin ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 text-caption">
                                <div>
                                  <span className="text-ink-500">Banco:</span>
                                  <p className="font-semibold text-ink-900">{s.bankDetails.bank}</p>
                                </div>
                                <div>
                                  <span className="text-ink-500">Tipo de cuenta:</span>
                                  <p className="font-semibold capitalize text-ink-900">{s.bankDetails.accountType}</p>
                                </div>
                                <div>
                                  <span className="text-ink-500">N° de cuenta:</span>
                                  <p className="font-mono font-bold text-ink-900">{s.bankDetails.accountNumber}</p>
                                </div>
                                <div>
                                  <span className="text-ink-500">Email transferencias:</span>
                                  <p className="font-semibold text-ink-900 truncate">{s.bankDetails.transferEmail}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center gap-2 text-caption text-ink-500 italic">
                                <Lock size={14} />
                                <span>Datos bancarios protegidos por seguridad financiera. Solo visibles para rol Administrador.</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
                          <IconButton
                            label="Editar proveedor"
                            onClick={() => {
                              setEditingSupplier(s);
                              setSupRut(s.rut);
                              setSupBusinessName(s.businessName);
                              setSupTradeName(s.tradeName);
                              setSupCategory(s.category);
                              setSupPhone(s.phone);
                              setSupEmail(s.email);
                              setSupAddress(s.address);
                              setSupContactName(s.contactName);
                              setSupContactPhone(s.contactPhone);
                              setSupBank(s.bankDetails.bank);
                              setSupAccountType(s.bankDetails.accountType);
                              setSupAccountNumber(s.bankDetails.accountNumber);
                              setSupTransferEmail(s.bankDetails.transferEmail);
                              setSupplierModalOpen(true);
                            }}
                          >
                            <Edit2 size={16} />
                          </IconButton>

                          <IconButton
                            label={isDisabled ? "Habilitar proveedor" : "Deshabilitar proveedor (nunca eliminar)"}
                            onClick={() => setDisablingEntity({ type: "supplier", item: s })}
                            className={isDisabled ? "text-ok hover:bg-ok-soft" : "text-danger hover:bg-danger-soft"}
                          >
                            {isDisabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                          </IconButton>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ),
          },
          {
            id: "clientes",
            label: "Clientes",
            content: (
              <div className="space-y-5">
                {/* Búsqueda Clientes */}
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar cliente por RUT, razón social..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                {/* Lista de Clientes */}
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredClients.map((c) => {
                    const isDisabled = Boolean(c.disabled);

                    return (
                      <Card
                        key={c.id}
                        className={`flex flex-col justify-between p-5 transition ${
                          isDisabled ? "opacity-60 bg-ink-50 border-ink-200" : "hover:border-brand-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-body font-bold text-ink-900">{c.businessName}</h3>
                                {isDisabled && <Badge tone="mute">Deshabilitado</Badge>}
                              </div>
                              <span className="font-mono text-caption font-bold text-brand-700">{c.rut}</span>
                              <p className="text-caption text-ink-500">{c.category}</p>
                            </div>

                            <span className="rounded-xl bg-brand-50 px-2.5 py-1 text-caption font-bold text-brand-700">
                              {c.activeProjectsCount} {c.activeProjectsCount === 1 ? "obra activa" : "obras activas"}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1 text-body-sm text-ink-700">
                            <p className="flex items-center gap-1.5 text-caption">
                              <MapPin size={14} className="text-ink-500 shrink-0" />
                              <span>{c.address}</span>
                            </p>
                            <p className="flex items-center gap-1.5 text-caption">
                              <Phone size={14} className="text-ink-500 shrink-0" />
                              <span>{c.phone} · Contacto: <strong>{c.contactName}</strong></span>
                            </p>
                            <p className="flex items-center gap-1.5 text-caption">
                              <Mail size={14} className="text-ink-500 shrink-0" />
                              <span>{c.email}</span>
                            </p>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="mt-4 flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
                          <IconButton
                            label="Editar cliente"
                            onClick={() => {
                              setEditingClient(c);
                              setCliRut(c.rut);
                              setCliBusinessName(c.businessName);
                              setCliCategory(c.category);
                              setCliPhone(c.phone);
                              setCliEmail(c.email);
                              setCliAddress(c.address);
                              setCliContactName(c.contactName);
                              setClientModalOpen(true);
                            }}
                          >
                            <Edit2 size={16} />
                          </IconButton>

                          <IconButton
                            label={isDisabled ? "Habilitar cliente" : "Deshabilitar cliente (nunca eliminar)"}
                            onClick={() => setDisablingEntity({ type: "client", item: c })}
                            className={isDisabled ? "text-ok hover:bg-ok-soft" : "text-danger hover:bg-danger-soft"}
                          >
                            {isDisabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                          </IconButton>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* ─── MODAL PROVEEDOR (CON RUT VERIFICADO Y DATOS BANCARIOS ADMIN) ─── */}
      {supplierModalOpen && (
        <Modal
          open={supplierModalOpen}
          onClose={() => setSupplierModalOpen(false)}
          title={editingSupplier ? `Editar Proveedor ${editingSupplier.businessName}` : "Registrar Nuevo Proveedor"}
          description="Valida RUT chileno con dígito verificador y asigna datos bancarios seguros."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setSupplierModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!isSupRutValid || isSupRutDuplicate || !supRut.trim() || !supBusinessName.trim()}
                onClick={handleSaveSupplier}
              >
                {editingSupplier ? "Guardar Proveedor" : "Registrar Proveedor"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveSupplier} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  RUT Proveedor (Con guion y DV):
                </label>
                <input
                  type="text"
                  required
                  value={supRut}
                  onChange={(e) => setSupRut(e.target.value.toUpperCase())}
                  placeholder="Ej: 76.432.890-K"
                  className={`w-full rounded-xl border p-2.5 font-mono text-body-sm uppercase focus:outline-none ${
                    !isSupRutValid || isSupRutDuplicate
                      ? "border-danger bg-danger-soft/20 text-danger"
                      : "border-ink-200 focus:border-brand-600"
                  }`}
                />
                {!isSupRutValid && (
                  <p className="mt-1 text-[11px] font-bold text-danger">RUT o dígito verificador incorrecto.</p>
                )}
                {isSupRutDuplicate && (
                  <p className="mt-1 text-[11px] font-bold text-danger">Este RUT ya está registrado.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Rubro / Categoría:
                </label>
                <select
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="Ferretería">Ferretería</option>
                  <option value="Climatización">Climatización</option>
                  <option value="Gasfitería">Gasfitería</option>
                  <option value="EPP">EPP y Seguridad</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Razón Social:
                </label>
                <input
                  type="text"
                  required
                  value={supBusinessName}
                  onChange={(e) => setSupBusinessName(e.target.value)}
                  placeholder="Ej: Schneider Electric Chile S.A."
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Nombre de Fantasía:
                </label>
                <input
                  type="text"
                  value={supTradeName}
                  onChange={(e) => setSupTradeName(e.target.value)}
                  placeholder="Ej: Schneider Electric"
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Teléfono Comercial:
                </label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Email de Contacto:
                </label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="contacto@proveedor.cl"
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Dirección Comercial:
              </label>
              <input
                type="text"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                placeholder="Av. Providencia 1234, Santiago"
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            {/* ─── DATOS BANCARIOS (ADMIN) ─── */}
            <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-caption font-bold text-brand-900">
                <CreditCard size={16} />
                <span>Datos Bancarios (Solo Administración):</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-caption text-ink-700">Banco:</label>
                  <select
                    value={supBank}
                    onChange={(e) => setSupBank(e.target.value)}
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-body-sm"
                  >
                    <option value="Banco de Chile">Banco de Chile</option>
                    <option value="Banco Santander">Banco Santander</option>
                    <option value="Banco BCI">Banco BCI</option>
                    <option value="Banco Estado">Banco Estado</option>
                    <option value="Banco Itaú">Banco Itaú</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-caption text-ink-700">Tipo de Cuenta:</label>
                  <select
                    value={supAccountType}
                    onChange={(e) => setSupAccountType(e.target.value as any)}
                    className="w-full rounded-lg border border-ink-200 bg-white p-2 text-body-sm capitalize"
                  >
                    <option value="corriente">Cuenta Corriente</option>
                    <option value="vista">Cuenta Vista</option>
                    <option value="ahorro">Cuenta de Ahorro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-caption text-ink-700">N° de Cuenta:</label>
                  <input
                    type="text"
                    value={supAccountNumber}
                    onChange={(e) => setSupAccountNumber(e.target.value)}
                    placeholder="00-123-45678-90"
                    className="w-full rounded-lg border border-ink-200 p-2 font-mono text-body-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-caption text-ink-700">Email Comprobantes:</label>
                  <input
                    type="email"
                    value={supTransferEmail}
                    onChange={(e) => setSupTransferEmail(e.target.value)}
                    placeholder="pagos@proveedor.cl"
                    className="w-full rounded-lg border border-ink-200 p-2 text-body-sm"
                  />
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL CLIENTE ─── */}
      {clientModalOpen && (
        <Modal
          open={clientModalOpen}
          onClose={() => setClientModalOpen(false)}
          title={editingClient ? `Editar Cliente ${editingClient.businessName}` : "Registrar Nuevo Cliente"}
          description="Ingresa los datos comerciales del cliente u organización mandante."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setClientModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!isCliRutValid || isCliRutDuplicate || !cliRut.trim() || !cliBusinessName.trim()}
                onClick={handleSaveClient}
              >
                {editingClient ? "Guardar Cliente" : "Registrar Cliente"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  RUT Cliente (Con DV):
                </label>
                <input
                  type="text"
                  required
                  value={cliRut}
                  onChange={(e) => setCliRut(e.target.value.toUpperCase())}
                  placeholder="Ej: 76.123.456-7"
                  className={`w-full rounded-xl border p-2.5 font-mono text-body-sm uppercase focus:outline-none ${
                    !isCliRutValid || isCliRutDuplicate
                      ? "border-danger bg-danger-soft/20 text-danger"
                      : "border-ink-200 focus:border-brand-600"
                  }`}
                />
                {!isCliRutValid && (
                  <p className="mt-1 text-[11px] font-bold text-danger">RUT o dígito verificador incorrecto.</p>
                )}
                {isCliRutDuplicate && (
                  <p className="mt-1 text-[11px] font-bold text-danger">Este RUT ya está registrado.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Rubro / Tipo:
                </label>
                <select
                  value={cliCategory}
                  onChange={(e) => setCliCategory(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="Inmobiliaria & Construcción">Inmobiliaria & Construcción</option>
                  <option value="Salud & Clínicas">Salud & Clínicas</option>
                  <option value="Centros de Distribución">Centros de Distribución</option>
                  <option value="Condominios & Edificios">Condominios & Edificios</option>
                  <option value="Oficinas Corporativas">Oficinas Corporativas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Razón Social / Nombre:
              </label>
              <input
                type="text"
                required
                value={cliBusinessName}
                onChange={(e) => setCliBusinessName(e.target.value)}
                placeholder="Ej: Inmobiliaria Pacífico SpA"
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Teléfono:
                </label>
                <input
                  type="text"
                  value={cliPhone}
                  onChange={(e) => setCliPhone(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Email:
                </label>
                <input
                  type="email"
                  value={cliEmail}
                  onChange={(e) => setCliEmail(e.target.value)}
                  placeholder="contacto@cliente.cl"
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Dirección:
              </label>
              <input
                type="text"
                value={cliAddress}
                onChange={(e) => setCliAddress(e.target.value)}
                placeholder="Av. El Golf 150, Las Condes"
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL CONFIRMAR DESHABILITAR (NUNCA ELIMINAR) ─── */}
      {disablingEntity && (
        <Modal
          open={Boolean(disablingEntity)}
          onClose={() => setDisablingEntity(null)}
          title={
            disablingEntity.item.disabled
              ? "¿Habilitar registro?"
              : "¿Deshabilitar registro?"
          }
          description="Regla de negocio: Los registros de proveedores y clientes nunca se eliminan físicamente para mantener la integridad de compras, contratos y proyectos."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDisablingEntity(null)}>
                Cancelar
              </Button>
              <Button
                variant={disablingEntity.item.disabled ? "primary" : "danger"}
                onClick={handleToggleDisable}
              >
                {disablingEntity.item.disabled ? "Habilitar registro" : "Deshabilitar registro"}
              </Button>
            </div>
          }
        >
          <p className="text-body-sm text-ink-700">
            {disablingEntity.item.disabled
              ? `El registro ${disablingEntity.item.businessName} volverá a estar disponible para nuevas operaciones.`
              : `Al deshabilitar a ${disablingEntity.item.businessName}, no podrá asociarse a nuevas órdenes ni obras, pero todo su historial comercial se mantendrá preservado.`}
          </p>
        </Modal>
      )}
    </div>
  );
}
