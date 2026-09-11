import React from "react";
import {
  Navigation,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  CornerUpRight,
  CornerUpLeft,
  Merge,
  RotateCw,
  Flag,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

function maneuverIcon(maneuver) {
  if (!maneuver) return Navigation;
  const m = maneuver.toLowerCase();
  if (m.includes("uturn")) return m.includes("left") ? CornerUpLeft : CornerUpRight;
  if (m.includes("roundabout") || m.includes("circle")) return RotateCw;
  if (m.includes("merge")) return Merge;
  if (m.includes("fork") || m.includes("keep")) return m.includes("left") ? ArrowUpLeft : ArrowUpRight;
  if (m.includes("ramp")) return m.includes("left") ? ArrowUpLeft : ArrowUpRight;
  if (m.includes("turn-sharp")) return m.includes("left") ? ArrowLeft : ArrowRight;
  if (m.includes("turn-slight")) return m.includes("left") ? ArrowUpLeft : ArrowUpRight;
  if (m.includes("turn-left")) return ArrowUpLeft;
  if (m.includes("turn-right")) return ArrowUpRight;
  if (m.includes("straight") || m.includes("continue")) return ArrowUp;
  if (m.includes("arrive") || m.includes("end")) return Flag;
  if (m.includes("depart")) return Navigation;
  return Navigation;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export default function TurnByTurnNav({
  routeInfo,
  phaseLabel,
  targetAddress,
  remainingTime,
  remainingDistance,
}) {
  const ManeuverIcon = maneuverIcon(routeInfo?.nextManeuver);
  const distance = routeInfo?.nextManeuverDistanceMeters;
  const instruction = routeInfo?.nextInstruction || "Calculando la mejor ruta...";
  const hasDistance = Number.isFinite(distance) && distance !== null;

  const afterInstruction = routeInfo?.afterNextInstruction;
  const AfterIcon = maneuverIcon(routeInfo?.afterNextManeuver);

  const isUrgent = hasDistance && distance < 80;
  const isApproaching = hasDistance && distance < 200 && distance >= 80;

  return (
    <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto space-y-2">
        {/* GPS-style maneuver banner */}
        <div
          className={`rounded-2xl border shadow-2xl overflow-hidden transition-colors duration-300 ${
            isUrgent
              ? "bg-accent border-accent"
              : "bg-[#0e1320]/95 border-accent/40"
          }`}
        >
          <div className="flex items-stretch">
            {/* Left: big maneuver icon + distance */}
            <div
              className={`flex flex-col items-center justify-center px-5 py-4 shrink-0 min-w-[120px] border-r ${
                isUrgent ? "border-accent-foreground/20" : "border-accent/30 bg-accent/10"
              }`}
            >
              <ManeuverIcon
                className={`w-12 h-12 mb-1.5 ${isUrgent ? "text-accent-foreground" : "text-accent"}`}
                strokeWidth={2.5}
              />
              {hasDistance ? (
                <span
                  className={`text-3xl font-extrabold leading-none ${
                    isUrgent ? "text-accent-foreground" : "text-accent"
                  }`}
                >
                  {formatDistance(distance)}
                </span>
              ) : null}
            </div>

            {/* Right: instruction */}
            <div className="px-4 py-3 flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                    isUrgent
                      ? "bg-accent-foreground/15 text-accent-foreground"
                      : "bg-accent/15 text-accent"
                  }`}
                >
                  {phaseLabel}
                </span>
                {(remainingTime || remainingDistance) && (
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ml-auto ${
                      isUrgent ? "text-accent-foreground/80" : "text-white/60"
                    }`}
                  >
                    {[remainingTime, remainingDistance].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <p
                className={`text-lg font-bold leading-tight ${
                  isUrgent ? "text-accent-foreground" : "text-white"
                }`}
              >
                {instruction}
              </p>
              {targetAddress && (
                <p
                  className={`text-xs mt-1 truncate ${
                    isUrgent ? "text-accent-foreground/70" : "text-white/50"
                  }`}
                >
                  {targetAddress}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* "Después" preview */}
        {afterInstruction && !isUrgent && (
          <div className="rounded-xl bg-card/95 border border-border shadow-lg px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold shrink-0">
              después
            </span>
            <AfterIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">{afterInstruction}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}