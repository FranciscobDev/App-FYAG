import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <Construction className="text-brand-600" size={32} />
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-ink-500">Esta pantalla se diseñará en los próximos pasos.</p>
    </Card>
  );
}
