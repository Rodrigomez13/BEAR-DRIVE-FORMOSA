import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

// Smooth transition between nested routes (tabs) while the shell and its
// bottom nav stay fixed — no remount, no abrupt cuts.
export default function AnimatedOutlet() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full w-full"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}