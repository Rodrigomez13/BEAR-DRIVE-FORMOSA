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

  return (
    <div className="absolute inset-x-0 top-0 z-10 p-3 safe-top pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        {/* Main maneuver card */}
        <div className="rounded-2xl bg-[#181E2F]/95 border border-white/10 text-white shadow-xl overflow-hidden">
          <div className="flex items-stretch">
            {/* Distance + icon column */}
            <div className="flex flex-col items-center justify-center px-4 py-3 bg-accent/15 shrink-0 min-w-[96px]">
              {hasDistance ? (
                <span className="text-2xl font-extrabold text-accent leading-none">
                  {formatDistance(distance)}
                </span>
              ) : (
                <Navigation className="w-7 h-7 text-accent" />
              )}
              <span className="text-[10px] text-white/50 mt-1">próxima</span>
            </div>
            {/* Instruction column */}
            <div className="px-4 py-3 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[11px] uppercase tracking-wide text-white/55 font-semibold">
                  {phaseLabel}
                </p>
                {(remainingTime || remainingDistance) && (
                  <span className="text-xs text-accent font-semibold whitespace-nowrap">
                    {[remainingTime, remainingDistance].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ManeuverIcon className="w-5 h-5 text-accent shrink-0" />
                <p className="text-base font-bold leading-snug">{instruction}</p>
              </div>
              {targetAddress && (
                <p className="text-xs text-white/55 mt-1 truncate">{targetAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Next step preview */}
        {routeInfo?.nextInstruction && routeInfo?.currentStepIndex !== undefined && (
          <NextStepPreview routeInfo={routeInfo} />
        )}
      </div>
    </div>
  );
}

function NextStepPreview({ routeInfo }) {
  // We don't have the full step list in routeInfo, but the MapView advances
  // currentStepIndex. The next-next instruction isn't exposed separately,
  // so we show a compact "después" hint only when we have remaining trip info.
  if (!routeInfo?.durationText && !routeInfo?.distanceText) return null;
  return (
    <div className="mt-2 rounded-xl bg-card/90 border border-border shadow-md px-3 py-2 flex items-center gap-2">
      <Navigation className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground truncate">
        Restante del viaje: {[routeInfo.durationText, routeInfo.distanceText].filter(Boolean).join(" · ")}
      </span>
    </div>
  );
}