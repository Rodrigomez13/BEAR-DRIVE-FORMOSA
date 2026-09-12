import React from "react";
import { motion } from "framer-motion";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_SVG } from "@/lib/brandAssets";

// Branded startup splash shown while auth and public settings load.
export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bear-gradient overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <div className="w-28 h-28 flex items-center justify-center">
          <Image
            src={BEAR_LOGO_SVG}
            alt="BearDrive"
            className="w-full h-full object-contain"
          />
        </div>
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5, ease: "easeOut" }}
          className="mt-5 text-3xl font-extrabold tracking-tight text-white"
        >
          Bear<span className="text-accent">Drive</span>
        </motion.span>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-1.5 text-xs font-medium text-white/50 tracking-wide"
        >
          Movilidad urbana en Formosa
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="absolute bottom-16 flex items-center gap-1.5"
      >
        {[0, 160, 320].map((d) => (
          <span
            key={d}
            className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </motion.div>
    </div>
  );
}