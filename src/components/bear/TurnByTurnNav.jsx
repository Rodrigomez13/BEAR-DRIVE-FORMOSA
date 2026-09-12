import React, { useState, useEffect } from "react";
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
  Volume2,
  VolumeX,
} from "lucide-react";
import navVoice from "@/lib/navVoice";
import Haptics from "@/lib/haptics";

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
  const [muted, setMuted] = useState(() => navVoice.isMuted());
  const ManeuverIcon = maneuverIcon(routeInfo?.nextManeuver);
  const distance = routeInfo?.nextManeuverDistanceMeters;
  const instruction = routeInfo?.nextInstruction || "Seguí la ruta indicada";
  const hasDistance = Number.isFinite(distance) && distance !== null;

  const afterInstruction = routeInfo?.afterNextInstruction;
  const AfterIcon = maneuverIcon(routeInfo?.afterNextManeuver);

  const isUrgent = hasDistance && distance < 65;

  // Vocalize maneuver when entering instruction window
  useEffect(() => {
    if (hasDistance && instruction) {
      navVoice.announceManeuver(instruction, distance, isUrgent);
      if (isUrgent) {
        Haptics.light();
      }
    }
  }, [instruction, distance, isUrgent, hasDistance]);

  const handleToggleMute = (e) => {
    e.stopPropagation();
    Haptics.light();
    const newMuted = navVoice.toggleMute();
    setMuted(newMuted);
  };

  return (
    <div className="absolute inset-x-0 top-0 z-20 p-3 safe-top pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto space-y-2">
        {/* Native GPS Maneuver Card */}
        <div
          className={`rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
            isUrgent
              ? "bg-[#E9B74E] text-[#181E2F] border-[#E9B74E] shadow-[#E9B74E]/30 scale-[1.01]"
              : "bg-[#0e1320]/95 backdrop-blur-md border-[#E9B74E]/40 text-white"
          }`}
        >
          <div className="flex items-stretch">
            {/* Left: Prominent maneuver icon & distance */}
            <div
              className={`flex flex-col items-center justify-center px-4 py-3.5 shrink-0 min-w-[110px] border-r ${
                isUrgent ? "border-[#181E2F]/20 bg-black/5" : "border-white/10 bg-[#181E2F]/60"
              }`}
            >
              <ManeuverIcon
                className={`w-11 h-11 mb-1 ${isUrgent ? "text-[#181E2F]" : "text-[#E9B74E]"}`}
                strokeWidth={2.6}
              />
              {hasDistance ? (
                <span
                  className={`text-2xl font-black tracking-tight leading-none ${
                    isUrgent ? "text-[#181E2F]" : "text-[#E9B74E]"
                  }`}
                >
                  {formatDistance(distance)}
                </span>
              ) : null}
            </div>

            {/* Right: Text instruction + ETA + Sound Toggle */}
            <div className="px-3.5 py-3 flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                    isUrgent
                      ? "bg-[#181E2F]/15 text-[#181E2F]"
                      : "bg-[#E9B74E]/20 text-[#E9B74E]"
                  }`}
                >
                  {phaseLabel}
                </span>

                <div className="flex items-center gap-2">
                  {(remainingTime || remainingDistance) && (
                    <span
                      className={`text-xs font-bold whitespace-nowrap ${
                        isUrgent ? "text-[#181E2F]/80" : "text-white/70"
                      }`}
                    >
                      {[remainingTime, remainingDistance].filter(Boolean).join(" • ")}
                    </span>
                  )}

                  {/* Audio Mute/Unmute Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition active:scale-90 ${
                      isUrgent
                        ? "bg-[#181E2F]/20 text-[#181E2F] hover:bg-[#181E2F]/30"
                        : "bg-white/10 text-white/80 hover:text-white hover:bg-white/20"
                    }`}
                    title={muted ? "Activar voz" : "Silenciar voz"}
                  >
                    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <p
                className={`text-base font-bold leading-tight line-clamp-2 ${
                  isUrgent ? "text-[#181E2F]" : "text-white"
                }`}
              >
                {instruction}
              </p>

              {targetAddress && (
                <p
                  className={`text-[11px] mt-0.5 truncate ${
                    isUrgent ? "text-[#181E2F]/75 font-medium" : "text-white/50"
                  }`}
                >
                  {targetAddress}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Secondary "Después" preview banner */}
        {afterInstruction && !isUrgent && (
          <div className="rounded-xl bg-[#181E2F]/90 backdrop-blur-md border border-white/10 shadow-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in duration-200">
            <span className="text-[10px] uppercase tracking-wider text-[#E9B74E] font-bold shrink-0">
              después
            </span>
            <AfterIcon className="w-3.5 h-3.5 text-white/70 shrink-0" />
            <span className="text-xs text-white/80 truncate flex-1">{afterInstruction}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}