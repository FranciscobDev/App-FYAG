import {
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Package,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { Product } from "@/core/types";
import { PRODUCTS } from "@/data/mock";
import { CardexTab } from "./CardexTab";
import { CatalogTab } from "./CatalogTab";
import { KitsTab } from "./KitsTab";
import { PhysicalCountTab } from "./PhysicalCountTab";
import { WasteTab } from "./WasteTab";

interface InventoryPageProps {
  defaultTab?: string;
}

export function InventoryPage({ defaultTab = "catalogo" }: InventoryPageProps) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleProductStockChange = (sku: string, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, stock: newStock } : p)),
    );
  };

  const tabs = [
    {
      id: "catalogo",
      label: "Catálogo",
      content: (
        <CatalogTab
          products={products}
          onUpdateProducts={setProducts}
        />
      ),
    },
    {
      id: "cardex",
      label: "Cardex (Movimientos)",
      content: <CardexTab products={products} />,
    },
    {
      id: "kits",
      label: "Kits de Insumos",
      content: <KitsTab products={products} />,
    },
    {
      id: "mermas",
      label: "Mermas y Bajas",
      content: (
        <WasteTab
          products={products}
          onProductStockChange={handleProductStockChange}
        />
      ),
    },
    {
      id: "conteo",
      label: "Conteo Físico",
      content: (
        <PhysicalCountTab
          products={products}
          onProductStockChange={handleProductStockChange}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión Integral de Inventario"
        subtitle="Control de catálogo, trazabilidad Cardex, kits de faena, mermas y auditorías de conteo físico"
      />

      <Tabs
        label="Secciones de Inventario"
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
      />
    </div>
  );
}
