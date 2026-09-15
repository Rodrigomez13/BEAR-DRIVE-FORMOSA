import { ChevronDown, ChevronUp } from "lucide-react";

/** A bounded, non-modal map panel: the map and bottom navigation remain usable. */
export default function MapBottomSheet({ title, subtitle, expanded = true, onToggle, children }) {
  return <section aria-label={title} className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
    <header className="px-4 pt-2 pb-3 border-b border-border/60">
      <div aria-hidden="true" className="w-9 h-1 rounded-full bg-muted-foreground/25 mx-auto mb-2" />
      <div className="flex items-center gap-3"><div className="flex-1 min-w-0"><h2 className="font-bold text-lg">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}</div>{onToggle && <button type="button" aria-label={expanded ? "Mostrar más mapa" : "Ampliar panel de viaje"} aria-expanded={expanded} onClick={onToggle} className="w-12 h-12 shrink-0 rounded-xl bg-secondary flex items-center justify-center">{expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}</button>}</div>
    </header>
    <div className="map-sheet-content px-4 py-3">{children}</div>
  </section>;
}
