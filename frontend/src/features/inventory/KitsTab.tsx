import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Edit2,
  Package,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/overlay/Modal";
import { useToast } from "@/components/overlay/Toast";
import type { Kit, KitItem, Product } from "@/core/types";
import { KITS } from "@/data/mock";

interface KitsTabProps {
  products: Product[];
  kits?: Kit[];
  onUpdateKits?: (kits: Kit[]) => void;
}

export function KitsTab({ products, kits = KITS, onUpdateKits }: KitsTabProps) {
  const toast = useToast();
  const [kitsList, setKitsList] = useState<Kit[]>(kits);

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);

  // Campos de formulario
  const [kitId, setKitId] = useState("");
  const [kitName, setKitName] = useState("");
  const [kitDesc, setKitDesc] = useState("");
  const [kitCategory, setKitCategory] = useState("Eléctrico");
  const [kitItems, setKitItems] = useState<KitItem[]>([
    { sku: products[0]?.sku ?? "ELE-DIS-0016", name: products[0]?.name ?? "", quantity: 2, unit: "un" },
  ]);

  // Calcula disponibilidad de un kit contra el stock actual de productos
  const getKitAvailability = (kit: Kit) => {
    const missing: { name: string; needed: number; available: number; unit: string }[] = [];
    let maxAssemble = Infinity;

    for (const item of kit.items) {
      const prod = products.find((p) => p.sku === item.sku);
      const available = prod ? prod.stock : 0;
      const canMake = item.quantity > 0 ? Math.floor(available / item.quantity) : 0;
      if (canMake < maxAssemble) maxAssemble = canMake;

      if (available < item.quantity) {
        missing.push({
          name: item.name || prod?.name || item.sku,
          needed: item.quantity,
          available,
          unit: item.unit,
        });
      }
    }

    if (maxAssemble === Infinity) maxAssemble = 0;

    return {
      isAvailable: missing.length === 0 && maxAssemble > 0,
      maxAssemble,
      missing,
    };
  };

  const openCreateModal = () => {
    setEditingKit(null);
    setKitId(`KIT-${Date.now().toString().slice(-4)}`);
    setKitName("");
    setKitDesc("");
    setKitCategory("Eléctrico");
    setKitItems([
      { sku: products[0]?.sku ?? "ELE-DIS-0016", name: products[0]?.name ?? "", quantity: 2, unit: "un" },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (kit: Kit) => {
    setEditingKit(kit);
    setKitId(kit.id);
    setKitName(kit.name);
    setKitDesc(kit.description);
    setKitCategory(kit.category);
    setKitItems([...kit.items]);
    setModalOpen(true);
  };

  const handleAddItem = () => {
    const first = products[0];
    setKitItems([
      ...kitItems,
      { sku: first?.sku ?? "ELE-DIS-0016", name: first?.name ?? "", quantity: 1, unit: first?.unit ?? "un" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setKitItems(kitItems.filter((_, i) => i !== index));
  };

  const handleItemSkuChange = (index: number, newSku: string) => {
    const prod = products.find((p) => p.sku === newSku);
    const updated = [...kitItems];
    updated[index] = {
      ...updated[index],
      sku: newSku,
      name: prod?.name ?? "",
      unit: prod?.unit ?? "un",
    };
    setKitItems(updated);
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const updated = [...kitItems];
    updated[index] = {
      ...updated[index],
      quantity: Math.max(1, qty),
    };
    setKitItems(updated);
  };

  const handleSaveKit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitId.trim() || !kitName.trim()) {
      toast({ tone: "warn", title: "Campos incompletos", description: "ID y Nombre son obligatorios." });
      return;
    }

    if (kitItems.length === 0) {
      toast({ tone: "warn", title: "Sin componentes", description: "El kit debe contener al menos un insumo." });
      return;
    }

    const newKit: Kit = {
      id: kitId.trim().toUpperCase(),
      name: kitName.trim(),
      description: kitDesc.trim(),
      category: kitCategory,
      items: kitItems,
    };

    let updated: Kit[];
    if (editingKit) {
      updated = kitsList.map((k) => (k.id === editingKit.id ? newKit : k));
      toast({ tone: "ok", title: "Kit actualizado", description: `Kit ${newKit.name} guardado con éxito.` });
    } else {
      updated = [...kitsList, newKit];
      toast({ tone: "ok", title: "Kit creado", description: `Nuevo Kit ${newKit.name} listo para uso.` });
    }

    setKitsList(updated);
    onUpdateKits?.(updated);
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* ─── ENCABEZADO Y BOTÓN CREAR ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-body-lg font-bold text-ink-900">
            Kits y Paquetes de Insumos Preconfigurados
          </h3>
          <p className="text-body-sm text-ink-500">
            Arma grupos estándar para faenas. La disponibilidad evalúa en tiempo real el stock de todos sus componentes.
          </p>
        </div>

        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <Plus size={18} />
          <span>Nuevo Kit</span>
        </Button>
      </div>

      {/* ─── TARJETAS DE KITS ─── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kitsList.map((kit) => {
          const avail = getKitAvailability(kit);

          return (
            <Card key={kit.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-ink-100 pb-3">
                  <div>
                    <span className="font-mono text-caption font-bold text-brand-700">
                      {kit.id}
                    </span>
                    <h4 className="mt-0.5 text-body font-bold text-ink-900">{kit.name}</h4>
                    <p className="text-caption text-ink-500">{kit.description}</p>
                  </div>

                  <IconButton label="Editar Kit" onClick={() => openEditModal(kit)}>
                    <Edit2 size={16} />
                  </IconButton>
                </div>

                {/* CHIP DE DISPONIBILIDAD EN VIVO */}
                <div className="mt-3">
                  {avail.isAvailable ? (
                    <div className="flex items-center gap-2 rounded-xl bg-ok-soft p-2.5 text-ok">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <div>
                        <p className="text-body-sm font-bold">
                          Disponible ({avail.maxAssemble} {avail.maxAssemble === 1 ? "kit armable" : "kits armables"})
                        </p>
                        <p className="text-caption text-ok/90">
                          Todos los insumos cuentan con stock suficiente en bodega.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-danger-line bg-danger-soft p-2.5 text-danger">
                      <div className="flex items-center gap-1.5 font-bold text-body-sm">
                        <AlertTriangle size={18} className="shrink-0" />
                        <span>Incompleto para armado</span>
                      </div>
                      <p className="mt-1 text-caption font-semibold">
                        Componentes faltantes:
                      </p>
                      <ul className="mt-0.5 list-disc pl-4 text-caption">
                        {avail.missing.map((m, idx) => (
                          <li key={idx}>
                            <strong>{m.name}:</strong> faltan {m.needed - m.available} {m.unit} (disponible: {m.available})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* LISTA DE COMPONENTES */}
                <div className="mt-4">
                  <p className="text-caption font-semibold uppercase text-ink-500">
                    Componentes incluidos ({kit.items.length}):
                  </p>
                  <ul className="mt-2 divide-y divide-ink-100 text-body-sm">
                    {kit.items.map((it) => (
                      <li key={it.sku} className="flex items-center justify-between py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink-900 truncate">{it.name}</p>
                          <p className="font-mono text-[11px] text-ink-500">{it.sku}</p>
                        </div>
                        <span className="font-bold tabular-nums text-ink-900">
                          {it.quantity} {it.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 border-t border-ink-100 pt-3">
                <span className="rounded-lg bg-ink-100 px-2.5 py-1 text-caption font-semibold text-ink-700">
                  Categoría: {kit.category}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ─── MODAL CREAR / EDITAR KIT ─── */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingKit ? `Editar Kit ${editingKit.id}` : "Crear Nuevo Kit"}
          description="Define el identificador del kit y los insumos requeridos con sus cantidades."
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveKit}>
                {editingKit ? "Guardar Kit" : "Crear Kit"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveKit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  ID del Kit (Único):
                </label>
                <input
                  type="text"
                  required
                  value={kitId}
                  onChange={(e) => setKitId(e.target.value.toUpperCase())}
                  placeholder="Ej: KIT-ELE-02"
                  className="w-full rounded-xl border border-ink-200 p-2.5 font-mono text-body-sm uppercase focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-caption font-semibold text-ink-900">
                  Categoría:
                </label>
                <select
                  value={kitCategory}
                  onChange={(e) => setKitCategory(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-white p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="Climatización">Climatización</option>
                  <option value="Gasfitería">Gasfitería</option>
                  <option value="EPP">EPP</option>
                  <option value="Ferretería">Ferretería</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Nombre del Kit:
              </label>
              <input
                type="text"
                required
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Ej: Kit Reparación Tableros Industriales"
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-caption font-semibold text-ink-900">
                Descripción / Uso:
              </label>
              <textarea
                rows={2}
                value={kitDesc}
                onChange={(e) => setKitDesc(e.target.value)}
                placeholder="Componentes esenciales para reparación rápida en obra."
                className="w-full rounded-xl border border-ink-200 p-2.5 text-body-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            {/* Componentes del Kit */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-caption font-semibold uppercase text-ink-700">
                  Componentes del Kit:
                </label>
                <Button size="md" variant="secondary" onClick={handleAddItem} className="text-caption">
                  <Plus size={14} />
                  <span>Agregar insumo</span>
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {kitItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-ink-200 p-2">
                    <select
                      value={item.sku}
                      onChange={(e) => handleItemSkuChange(idx, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white p-2 text-body-sm focus:border-brand-600 focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                        className="w-20 rounded-lg border border-ink-200 p-2 text-center text-body-sm tabular-nums focus:border-brand-600 focus:outline-none"
                      />
                      <span className="text-caption text-ink-500 font-mono w-10">{item.unit}</span>
                    </div>

                    <IconButton
                      label="Eliminar componente"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={kitItems.length <= 1}
                      className="text-danger hover:bg-danger-soft"
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
