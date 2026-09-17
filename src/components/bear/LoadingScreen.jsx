import React from "react";
import { motion } from "framer-motion";

export default function LoadingScreen({
  label = "Cargando...",
  className = "",
  mascotImage = "/assets/mascot/bear_costanera_wave_hd.jpg",
  showPinBadge = true,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center p-6 select-none ${className}`}
    >
      <div className="relative mb-5 flex items-center justify-center">
        {/* Pulsing ambient gold radar glow rings */}
        <div className="absolute w-56 h-56 rounded-full bg-[#E9B74E]/25 blur-2xl animate-pulse" />
        <div
          className="absolute w-60 h-60 rounded-full border border-[#E9B74E]/25 animate-ping opacity-40 pointer-events-none"
          style={{ animationDuration: "3s" }}
        />

        {/* Mascot badge container with smooth float */}
        <motion.div
          animate={{ y: [0, -6, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-3xl p-1.5 bg-gradient-to-tr from-[#cca03f] via-[#E9B74E] to-[#ffd470] shadow-[0_12px_35px_rgba(233,183,78,0.3)] flex items-center justify-center"
        >
          <div className="w-full h-full rounded-[22px] bg-[#141b2d] overflow-hidden relative flex items-center justify-center">
            <img
              src={mascotImage}
              alt="BearDrive"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "/beardrive-login-pin.png";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Mini Pin Emblem Badge Accent */}
          {showPinBadge && (
            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-[#0f1422] border-2 border-[#E9B74E] shadow-xl p-1 flex items-center justify-center overflow-hidden">
              <img
                src="/assets/mascot/bear_pin_emblem.png"
                alt="Bear Pin"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/beardrive-login-pin.png";
                }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Brand & Loading Label */}
      <div className="text-center space-y-2 max-w-xs z-10">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-extrabold tracking-tight text-foreground">
            BEAR<span className="text-[#E9B74E]">DRIVE</span>
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
            · Formosa
          </span>
        </div>

        {/* Animated Bouncing Gold Dots */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {[0, 180, 360].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-[#E9B74E] animate-bounce shadow-[0_0_8px_rgba(233,183,78,0.6)]"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>

        {label && (
          <p className="text-xs font-medium text-muted-foreground tracking-wide leading-relaxed">
            {label}
          </p>
        )}
      </div>
    </motion.div>
  );
}