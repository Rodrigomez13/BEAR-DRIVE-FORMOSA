import React from "react";

export default function SearchingDriverAnimation({ size = 240 }) {
  return (
    <div className="relative mx-auto mb-3 flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Radar pulse glow */}
      <div className="absolute inset-0 rounded-3xl bg-[#E9B74E]/15 animate-ping" style={{ animationDuration: "2.5s" }} />
      <div className="absolute inset-2 rounded-3xl bg-[#181E2F]/80 border border-[#E9B74E]/30 shadow-2xl backdrop-blur-sm" />

      <video
        src="./assets/mascot/bear-searching-loop.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Oso buscando conductor"
        className="relative z-10 w-full h-full object-contain bg-white rounded-3xl shadow-lg"
        style={{ width: size - 8, height: size - 8 }}
      />
    </div>
  );
}
