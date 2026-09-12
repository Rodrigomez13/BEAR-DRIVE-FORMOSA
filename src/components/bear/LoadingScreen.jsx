import React from "react";
import { motion } from "framer-motion";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_SVG } from "@/lib/brandAssets";

// Branded loading screen — BearDrive logo with a breathing pulse + gold dots.
// `className` controls how it fills its container (e.g. "h-full", "absolute inset-0", "h-64").
export default function LoadingScreen({ label = "Cargando...", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-20 h-20 flex items-center justify-center"
      >
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="w-full h-full"
        >
          <Image src={BEAR_LOGO_SVG} alt="BearDrive" className="w-full h-full object-contain" />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-4 flex items-center gap-1.5"
      >
        {[0, 160, 320].map((d) => (
          <span
            key={d}
            className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </motion.div>
      {label && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-3 text-xs font-medium text-muted-foreground"
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}