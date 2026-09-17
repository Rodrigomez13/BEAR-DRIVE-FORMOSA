import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

export default function BottomNav({ items, basePath }) {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <nav aria-label="Navegación principal" className="shrink-0 z-40 glass-navy border-t border-white/10">
      <div className="max-w-md mx-auto flex items-stretch px-2 safe-bottom">
        {items.map((item) => {
          const target = item.path ? `${basePath}/${item.path}` : basePath;
          const active = location.pathname.replace(/\/$/, '') === target || (item.path && location.pathname.startsWith(`${target}/`));
          return (
            <button
              key={item.path}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(item.path === "" ? basePath : `${basePath}/${item.path}`)}
              className={`tap-target relative min-w-0 flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors duration-200 no-select focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "text-accent" : "text-white/50 hover:text-white/80"
              }`}
            >
              <div className="relative p-1.5 flex items-center justify-center">
                {active && (
                  <motion.div
                    layoutId={reduceMotion ? undefined : `navActive-${basePath}`}
                    className="absolute inset-0 bg-accent/15 rounded-xl"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon
                  className={`relative w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>
              <span className="text-[14px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
