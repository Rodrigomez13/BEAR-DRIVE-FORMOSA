import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Splash() {
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(45), 300);
    const timer2 = setTimeout(() => setProgress(80), 800);
    const timer3 = setTimeout(() => setProgress(100), 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-[#0c101c] via-[#141b2d] to-[#1a233a] text-white overflow-hidden select-none">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial ambient gold spotlights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full bg-[#E9B74E]/15 blur-[100px] animate-pulse" style={{ animationDuration: "3.5s" }} />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#009EE3]/10 blur-[80px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
      </div>

      {/* Top Spacer / City Pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="pt-12 z-10"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#E9B74E] animate-ping" />
          <span className="text-[11px] font-semibold tracking-wider text-[#E9B74E] uppercase">
            Formosa · Tu Ciudad en Movimiento
          </span>
        </div>
      </motion.div>

      {/* Main Center Composition */}
      <div className="flex flex-col items-center px-6 max-w-sm text-center z-10 my-auto">
        {/* Mascot Hero with Formosa Landmarks + Gold Glow Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.82, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6 flex items-center justify-center"
        >
          {/* Pulsing golden aura */}
          <div className="absolute w-36 h-36 rounded-full bg-[#E9B74E]/25 blur-2xl animate-pulse" />
          <div className="absolute w-44 h-44 rounded-full border border-[#E9B74E]/20 animate-ping opacity-40" style={{ animationDuration: "3s" }} />

          {/* Double ring frame featuring 3D Formosa mascot */}
          <div className="relative w-32 h-32 rounded-3xl p-1 bg-gradient-to-tr from-[#E9B74E] via-[#ffdf88] to-[#996f1e] shadow-[0_0_35px_rgba(233,183,78,0.35)]">
            <div className="w-full h-full rounded-[22px] bg-[#0f1422] overflow-hidden relative flex items-center justify-center">
              <img
                src="/assets/mascot/bear_costanera_wave_hd.jpg"
                alt="BearDrive en Formosa"
                className="w-full h-full object-cover transform scale-105 hover:scale-110 transition-transform duration-700"
                onError={(e) => {
                  e.currentTarget.src = "/beardrive-login-pin.png";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Pin Emblem Badge Accent */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.45, duration: 0.5, type: "spring", stiffness: 260 }}
              className="absolute -bottom-2 -right-2 w-11 h-11 rounded-2xl bg-[#0f1422] border-2 border-[#E9B74E] shadow-xl p-1 flex items-center justify-center overflow-hidden"
            >
              <img
                src="/assets/mascot/bear_pin_emblem.png"
                alt="Bear Pin"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "/beardrive-login-pin.png";
                }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Brand Name & Slogan */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-center gap-1">
            <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-sm font-sans">
              BEAR<span className="text-[#E9B74E]">DRIVE</span>
            </h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="text-xs font-medium text-white/75 tracking-wide flex items-center justify-center gap-1.5"
          >
            <span>Compartiendo Destinos</span>
            <span className="text-[#E9B74E]">•</span>
            <span className="text-[#E9B74E] font-semibold">0% Comisión</span>
          </motion.p>
        </motion.div>
      </div>

      {/* Bottom Loading Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="w-full max-w-xs px-6 pb-12 z-10 flex flex-col items-center gap-3"
      >
        {/* Progress Bar Track */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm p-[1px]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#cca03f] via-[#E9B74E] to-[#ffd470] shadow-[0_0_12px_rgba(233,183,78,0.7)]"
            initial={{ width: "10%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Status label with animated dots */}
        <div className="flex items-center justify-between w-full text-[11px] text-white/60">
          <span className="flex items-center gap-1">
            <span>Iniciando servicio</span>
            <span className="inline-flex gap-0.5 ml-0.5">
              {[0, 200, 400].map((d) => (
                <span
                  key={d}
                  className="w-1 h-1 rounded-full bg-[#E9B74E] animate-pulse"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </span>
          <span className="font-mono text-[10px] text-[#E9B74E]/90 font-bold">{progress}%</span>
        </div>
      </motion.div>
    </div>
  );
}