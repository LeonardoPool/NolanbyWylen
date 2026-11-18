import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function VacacionesLoading() {
  return (
    <div className="space-y-6 animate-pulse py-2">
      <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-zinc-100 rounded-2xl border border-zinc-200/60" />
        ))}
      </div>
      <Card className="rounded-2xl border-zinc-200">
        <CardContent className="p-8 flex flex-col items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-400">Cargando fichas vacacionales LFT...</p>
        </CardContent>
      </Card>
    </div>
  );
}
