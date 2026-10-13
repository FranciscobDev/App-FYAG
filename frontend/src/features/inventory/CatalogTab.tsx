import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit2,
  Eye,
  FileSpreadsheet,
  MapPin,
  Package,
  Plus,
  QrCode,
  ScanLine,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import { SemaforoBadge } from "@/components/shared/EstadoBadge";
import { StockCell } from "@/components/shared/StockCell";
import { formatCLP, formatNumber } from "@/core/format";
import type { Product } from "@/core/types";
import { useAuth } from "@/features/auth/AuthContext";
import { PRODUCTS, STOCK_STATUS } from "@/data/mock";

interface CatalogTabProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
}

export function CatalogTab({ products, onUpdateProducts }: CatalogTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Campos de formulario
  const [formSku, setFormSku] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Eléctrico");
  const [formUnit, setFormUnit] = useState("un");
  const [formMinStock, setFormMinStock] = useState(10);
  const [formRestockQty, setFormRestockQty] = useState(25);
  const [formDefaultSupplier, setFormDefaultSupplier] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formLocation, setFormLocation] = useState("A-01-01");
  const [formUnitCost, setFormUnitCost] = useState(5000);
  const [formIsBulk, setFormIsBulk] = useState(false);
  const [formCapacity, setFormCapacity] = useState(100);

  // Modal Confirmación Deshabilitar
  const [disablingProduct, setDisablingProduct] = useState<Product | null>(null);

  // Categorías únicas
  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category)));
  }, [products]);

  // Filtrado reactivo en tiempo real al escribir
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormSku(`INS-${Date.now().toString().slice(-4)}`);
    setFormName("");
    setFormCategory("Eléctrico");
    setFormUnit("un");
    setFormMinStock(10);
    setFormRestockQty(25);
    setFormDefaultSupplier("Schneider Electric Chile");
    setFormBarcode("");
    setFormLocation("A-01-01");
    setFormUnitCost(5000);
    setFormIsBulk(false);
    setFormCapacity(100);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormUnit(p.unit);
    setFormMinStock(p.minStock);
    setFormRestockQty(p.restockQuantity ?? 20);
    setFormDefaultSupplier(p.defaultSupplier ?? "");
    setFormBarcode(p.barcode ?? "");
    setFormLocation(p.location);
    setFormUnitCost(p.unitCost);
    setFormIsBulk(Boolean(p.isBulk));
    setFormCapacity(p.containerCapacity ?? 100);
    setModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSku.trim() || !formName.trim()) {
      toast({ tone: "warn", title: "Campos incompletos", description: "SKU y Nombre son obligatorios." });
      return;
    }

    // Validar SKU único en modo creación
    if (!editingProduct && products.some((p) => p.sku.toLowerCase() === formSku.trim().toLowerCase())) {
      toast({
        tone: "danger",
        title: "SKU duplicado",
        description: `El SKU ${formSku} ya existe en el catálogo.`,
      });
      return;
    }

    if (editingProduct) {
      const updated = products.map((p) =>
        p.sku === editingProduct.sku
          ? {
              ...p,
              name: formName.trim(),
              category: formCategory,
              unit: formUnit,
              minStock: formMinStock,
              restockQuantity: formRestockQty,
              defaultSupplier: formDefaultSupplier.trim(),
              barcode: formBarcode.trim() || undefined,
              location: formLocation.trim(),
              unitCost: formUnitCost,
              pmp: formUnitCost,
              isBulk: formIsBulk,
              containerCapacity: formIsBulk ? formCapacity : undefined,
            }
          : p,
      );
      onUpdateProducts(updated);
      toast({ tone: "ok", title: "Insumo actualizado", description: `${formName} guardado con éxito.` });
    } else {
      const newProd: Product = {
        sku: formSku.trim().toUpperCase(),
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        stock: 0,
        committed: 0,
        quarantine: 0,
        minStock: formMinStock,
        restockQuantity: formRestockQty,
        defaultSupplier: formDefaultSupplier.trim(),
        barcode: formBarcode.trim() || undefined,
        location: formLocation.trim().toUpperCase(),
        unitCost: formUnitCost,
        pmp: formUnitCost,
        isBulk: formIsBulk,
        containerCapacity: formIsBulk ? formCapacity : undefined,
      };
      onUpdateProducts([newProd, ...products]);
      toast({ tone: "ok", title: "Insumo registrado", description: `${formName} añadido al catálogo.` });
    }

    setModalOpen(false);
  };

  const handleToggleDisabled = (p: Product) => {
    const updated = products.map((item) =>
      item.sku === p.sku ? { ...item, disabled: !item.disabled } : item,
    );
    onUpdateProducts(updated);
    toast({
      tone: p.disabled ? "ok" : "warn",
      title: p.disabled ? "Insumo habilitado" : "Insumo deshabilitado",
      description: p.disabled
        ? `${p.name} se encuentra activo para operaciones.`
        : `${p.name} fue deshabilitado (no se elimina historial).`,
    });
    setDisablingProduct(null);
  };

  return (
    <div className="space-y-5">
      {/* ─── BARRA DE CONTROL Y BÚSQUEDA ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Buscador reactivo */}
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 text-ink-500" size={16} />
            <input
              type="text"
              placeholder="Buscar por SKU, nombre o código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-9 pr-3 text-body-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Filtro categoría */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-body-sm text-ink-900 focus:border-brand-600 focus:outline-none"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Botón «Nuevo insumo» SOLO ADMIN */}
        {isAdmin && (
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus size={18} />
            <span>Nuevo insumo</span>
          </Button>
        )}
      </div>

      {/* ─── TABLA DE CATÁLOGO ─── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-ink-100/70 text-caption font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3 text-center">Disponible</th>
                <th className="px-4 py-3 text-center">Comprometido</th>
                <th className="px-4 py-3 text-center">Cuarentena</th>
                <th className="px-4 py-3 text-center">Mínimo</th>
                <th className="px-4 py-3 text-right">PMP / Costo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-body-sm text-ink-500">
                    No se encontraron insumos para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  const isZero = p.stock === 0;
                  const isDisabled = Boolean(p.disabled);

                  // Fila resaltada si disponible <= mínimo
                  const rowBg = isDisabled
                    ? "bg-ink-100/40 opacity-70"
                    : isZero
                      ? "bg-danger-soft/30 hover:bg-danger-soft/40"
                      : isLow
                        ? "bg-warn-soft/25 hover:bg-warn-soft/35"
                        : "hover:bg-ink-50/70";

                  return (
                    <tr key={p.sku} className={`transition ${rowBg}`}>
                      {/* SKU */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-caption font-bold text-ink-900">
                          {p.sku}
                        </span>
                        {p.barcode && (
                          <p className="flex items-center gap-1 font-mono text-[10px] text-ink-500">
                            <QrCode size={10} />
                            {p.barcode}
                          </p>
                        )}
                      </td>

                      {/* Insumo */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-ink-900">{p.name}</p>
                        <p className="text-caption text-ink-500">
                          {p.defaultSupplier || "Sin proveedor asignado"}
                          {p.isBulk && (
                            <span className="ml-1 rounded bg-brand-100 px-1 py-0.2 text-[10px] font-semibold text-brand-700">
                              Granel ({p.containerCapacity} {p.unit})
                            </span>
                          )}
                        </p>
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-3.5 text-ink-700">{p.category}</td>

                      {/* Ubicación */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-ink-100 px-2 py-0.5 font-mono text-caption font-semibold text-ink-800">
                          <MapPin size={11} />
                          {p.location}
                        </span>
                      </td>

                      {/* Disponible */}
                      <td className="px-4 py-3.5 text-center font-bold tabular-nums">
                        <span className={isZero ? "text-danger" : isLow ? "text-warn" : "text-ok"}>
                          {p.isBulk ? p.stock.toFixed(3) : p.stock} {p.unit}
                        </span>
                      </td>

                      {/* Comprometido */}
                      <td className="px-4 py-3.5 text-center font-medium tabular-nums text-ink-600">
                        {p.isBulk ? (p.committed ?? 0).toFixed(3) : (p.committed ?? 0)} {p.unit}
                      </td>

                      {/* Cuarentena */}
                      <td className="px-4 py-3.5 text-center font-medium tabular-nums text-ink-600">
                        {(p.quarantine ?? 0)} {p.unit}
                      </td>

                      {/* Mínimo */}
                      <td className="px-4 py-3.5 text-center font-medium tabular-nums text-ink-500">
                        {p.minStock} {p.unit}
                      </td>

                      {/* PMP / Costo */}
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-ink-900">
                        {formatCLP(p.pmp ?? p.unitCost)}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center">
                        {isDisabled ? (
                          <Badge tone="mute">Deshabilitado</Badge>
                        ) : isZero ? (
                          <SemaforoBadge nivel="rojo" label="Sin stock" />
                        ) : isLow ? (
                          <SemaforoBadge nivel="amarillo" label="Stock bajo" />
                        ) : (
                          <SemaforoBadge nivel="verde" label="Normal" />
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            label="Editar insumo"
                            onClick={() => openEditModal(p)}
                          >
                            <Edit2 size={16} />
                          </IconButton>
                          <IconButton
                            label={isDisabled ? "Habilitar insumo" : "Deshabilitar insumo (nunca eliminar)"}
                            onClick={() => setDisablingProduct(p)}
                            className={isDisabled ? "text-ok hover:bg-ok-soft" : "text-danger hover:bg-danger-soft"}
                          >
                            {isDisabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── MODAL CREAR / EDITAR INSUMO ─── */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingProduct ? `Editar Insumo ${editingProduct.sku}` : "Registrar Nuevo Insumo"}
          description="Configura los atributos de catálogo, stock de seguridad y proveedor."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProduct}>
                {editingProduct ? "Guardar cambios" : "Crear insumo"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  SKU (Único):
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingProduct)}
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                  placeholder="Ej: ELE-CBL-0012"
                  className="w-full rounded-xl border border-ink-200 p-2.5 font-mono text-body-sm uppercase focus:border-brand-600 focus:outline-none disabled:bg-ink-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Categoría:
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="Gasfitería">Gasfitería</option>
                  <option value="Climatización">Climatización</option>
                  <option value="Ferretería">Ferretería</option>
                  <option value="EPP">EPP</option>
                  <option value="Herramientas">Herramientas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Nombre del Insumo:
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: Cable THHN 12 AWG rollo 100 m"
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Unidad:
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => {
                    const u = e.target.value;
                    setFormUnit(u);
                    if (["kg", "m", "l"].includes(u)) {
                      setFormIsBulk(true);
                    }
                  }}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="un">un (unidad)</option>
                  <option value="kg">kg (kilogramos)</option>
                  <option value="m">m (metros)</option>
                  <option value="l">l (litros)</option>
                  <option value="rollo">rollo</option>
                  <option value="caja">caja</option>
                  <option value="cilindro">cilindro</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Stock Mínimo:
                </label>
                <input
                  type="number"
                  min={0}
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Cant. Reposición:
                </label>
                <input
                  type="number"
                  min={1}
                  value={formRestockQty}
                  onChange={(e) => setFormRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Proveedor Predeterminado:
                </label>
                <input
                  type="text"
                  value={formDefaultSupplier}
                  onChange={(e) => setFormDefaultSupplier(e.target.value)}
                  placeholder="Ej: Schneider Electric Chile"
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Ubicación en Bodega:
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value.toUpperCase())}
                  placeholder="Ej: A-01-03"
                  className="w-full rounded-xl border border-ink-200 p-2.5 font-mono text-body-sm uppercase focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Costo Unitario / PMP (CLP):
                </label>
                <input
                  type="number"
                  min={1}
                  value={formUnitCost}
                  onChange={(e) => setFormUnitCost(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  QR / Código de Barras (opcional):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="7809800..."
                    className="w-full rounded-xl border border-ink-200 p-2.5 pr-9 font-mono text-body-sm focus:border-brand-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFormBarcode(`780${Date.now().toString().slice(-9)}`)}
                    title="Autogenerar código"
                    className="absolute right-2 top-2.5 text-ink-500 hover:text-brand-600"
                  >
                    <ScanLine size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Configuración a granel */}
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
              <label className="flex items-center gap-2 text-body-sm font-semibold text-ink-900">
                <input
                  type="checkbox"
                  checked={formIsBulk}
                  onChange={(e) => setFormIsBulk(e.target.checked)}
                  className="size-4 rounded accent-brand-600"
                />
                <span>Manejo a granel (3 decimales y contenedor/carrete)</span>
              </label>

              {formIsBulk && (
                <div className="mt-2 text-body-sm">
                  <label className="block text-caption text-ink-600">
                    Capacidad máxima del contenedor / tambor / carrete ({formUnit}):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="mt-1 w-48 rounded-lg border border-ink-200 p-2 text-body-sm"
                  />
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL CONFIRMACIÓN DESHABILITAR (NUNCA ELIMINAR) ─── */}
      {disablingProduct && (
        <Modal
          open={Boolean(disablingProduct)}
          onClose={() => setDisablingProduct(null)}
          title={disablingProduct.disabled ? "¿Habilitar insumo?" : "¿Deshabilitar insumo?"}
          description="Regla de auditoría: los insumos nunca se eliminan de la base de datos para preservar la trazabilidad histórica de Cardex y proyectos."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDisablingProduct(null)}>
                Cancelar
              </Button>
              <Button
                variant={disablingProduct.disabled ? "primary" : "danger"}
                onClick={() => handleToggleDisabled(disablingProduct)}
              >
                {disablingProduct.disabled ? "Habilitar insumo" : "Deshabilitar insumo"}
              </Button>
            </div>
          }
        >
          <div className="space-y-2 text-body-sm text-ink-700">
            <p>
              Insumo seleccionado: <strong>{disablingProduct.name}</strong> ({disablingProduct.sku}).
            </p>
            <p>
              {disablingProduct.disabled
                ? "Al habilitarlo, volverá a estar disponible para solicitudes, egresos y conteos."
                : "Al deshabilitarlo, no podrá ser seleccionado en nuevas solicitudes ni egresos, pero todo su historial de movimientos permanecerá intacto."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
