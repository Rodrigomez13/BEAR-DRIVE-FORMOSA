import React, { useState, useEffect } from "react";

const SEARCH_FRAMES = [
  "./assets/mascot/frame_01.png",
  "./assets/mascot/frame_02.png",
  "./assets/mascot/frame_03.png",
  "./assets/mascot/frame_04.png",
  "./assets/mascot/frame_05.png",
  "./assets/mascot/frame_06.png",
  "./assets/mascot/frame_07.png",
  "./assets/mascot/frame_08.png",
];

export default function SearchingDriverAnimation({ size = 240 }) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SEARCH_FRAMES.length);
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto mb-3 flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Radar pulse glow */}
      <div className="absolute inset-0 rounded-3xl bg-[#E9B74E]/15 animate-ping" style={{ animationDuration: "2.5s" }} />
      <div className="absolute inset-2 rounded-3xl bg-[#181E2F]/80 border border-[#E9B74E]/30 shadow-2xl backdrop-blur-sm" />

      <img
        src={SEARCH_FRAMES[frameIndex]}
        alt="Buscando conductor"
        className="relative z-10 w-full h-full object-cover rounded-3xl shadow-lg"
        style={{ width: size - 8, height: size - 8 }}
      />
    </div>
  );
}