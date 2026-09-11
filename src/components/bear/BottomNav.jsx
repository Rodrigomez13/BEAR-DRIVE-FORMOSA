import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function BottomNav({ items, basePath }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="shrink-0 z-40 px-3 pb-2 safe-bottom pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="glass-navy rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-black/40 flex items-stretch px-1.5 py-1.5">
          {items.map((item) => {
            const active = location.pathname === `${basePath}/${item.path}` || (item.path === "" && location.pathname === basePath);
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path === "" ? basePath : `${basePath}/${item.path}`)}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative flex-1 flex flex-col items-center justify-center min-h-[56px] gap-1 rounded-xl"
              >
                {active && (
                  <motion.div
                    layoutId={`nav-pill-${basePath}`}
                    className="absolute inset-0 rounded-xl bg-accent/15 ring-1 ring-accent/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.div
                  animate={{ scale: active ? 1.15 : 1, y: active ? -2 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className={`relative p-1.5 rounded-xl transition-colors ${active ? "text-accent" : "text-white/45"}`}
                >
                  <item.icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 2} />
                </motion.div>
                <span className={`relative text-[10px] font-semibold tracking-tight transition-colors ${active ? "text-accent" : "text-white/45"}`}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}