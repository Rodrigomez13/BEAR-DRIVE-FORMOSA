import React from "react";
import { useOutlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// Smooth crossfade between nested routes (tabs) while the shell and its
// bottom nav stay fixed. Uses useOutlet() so the exiting page is frozen
// (not re-rendered to the new route), eliminating abrupt cuts.
export default function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="absolute inset-0"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}