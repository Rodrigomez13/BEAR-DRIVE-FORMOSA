import React from "react";
import { motion } from "framer-motion";

// High-end startup splash with official logo "BearDrive Compartiendo Destinos" + gold glow
export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#181E2F] overflow-hidden">
      {/* Background ambient radial light */}
      <div className="absolute w-96 h-96 rounded-full bg-[#E9B74E]/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center px-6 max-w-xs text-center z-10"
      >
        {/* Mascot Avatar Hero */}
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-full bg-[#E9B74E]/20 absolute inset-0 blur-lg animate-pulse" />
          <div className="w-28 h-28 rounded-full border-2 border-[#E9B74E] p-1 shadow-2xl bg-[#0e1320] flex items-center justify-center overflow-hidden">
            <img
              src="./assets/mascot/bear_costanera_wave.jpg"
              alt="BearDrive"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>

        {/* Official Brand Slogan Logo */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="w-full max-w-[260px]"
        >
          <img
            src="./assets/beardrive_logo_slogan.png"
            alt="BearDrive Compartiendo Destinos"
            className="w-full object-contain brightness-0 invert drop-shadow-md"
          />
        </motion.div>
      </motion.div>

      {/* Modern bounce loader at bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="absolute bottom-12 flex items-center gap-2"
      >
        {[0, 160, 320].map((d) => (
          <span
            key={d}
            className="w-2 h-2 rounded-full bg-[#E9B74E] animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </motion.div>
    </div>
  );
}