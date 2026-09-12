import React from "react";
import { motion } from "framer-motion";

// High-impact branded loading screen with 3D mascot + radar glow + official slogan
export default function LoadingScreen({ label = "Cargando...", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="relative mb-4 flex items-center justify-center">
        {/* Pulsing ambient gold glow */}
        <div className="absolute w-28 h-28 rounded-full bg-[#E9B74E]/20 blur-xl animate-pulse" />

        {/* Mascot badge */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], y: [0, -4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-24 h-24 rounded-3xl bg-[#181E2F] border-2 border-[#E9B74E]/40 shadow-2xl p-1.5 flex items-center justify-center overflow-hidden"
        >
          <img
            src="./assets/mascot/bear_smile_closeup.jpg"
            alt="BearDrive"
            className="w-full h-full object-cover rounded-2xl"
          />
        </motion.div>
      </div>

      {/* Brand slogan & status */}
      <div className="text-center space-y-2">
        <img
          src="./assets/beardrive_logo_slogan.png"
          alt="BearDrive Compartiendo Destinos"
          className="h-7 mx-auto object-contain brightness-0 invert opacity-90"
        />

        <div className="flex items-center justify-center gap-1.5 pt-1">
          {[0, 160, 320].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-[#E9B74E] animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>

        {label && (
          <p className="text-xs font-semibold text-muted-foreground tracking-wide">
            {label}
          </p>
        )}
      </div>
    </div>
  );
}