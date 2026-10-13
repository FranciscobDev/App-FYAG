import { Link } from "react-router";
import { Tabs } from "@/components/ui/Tabs";
import { DataTab } from "./DataTab";
import { FeedbackTab } from "./FeedbackTab";
import { FormsTab } from "./FormsTab";
import { FoundationsTab } from "./FoundationsTab";

export function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <Link to="/" className="mb-6 inline-flex min-h-11 items-center text-body-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
        ← Volver al inicio
      </Link>
      <h1 className="mb-1 text-display font-bold tracking-tight">Sistema de diseño</h1>
      <p className="mb-8 text-ink-500">Fundamentos y componentes de FYAG. Todo cumple contraste AA y es operable con teclado.</p>
      <Tabs
        label="Secciones del sistema de diseño"
        tabs={[
          { id: "fund", label: "Fundamentos", content: <FoundationsTab /> },
          { id: "forms", label: "Formularios", content: <FormsTab /> },
          { id: "feedback", label: "Overlays y feedback", content: <FeedbackTab /> },
          { id: "data", label: "Datos y compartidos", content: <DataTab /> },
        ]}
      />
    </div>
  );
}
