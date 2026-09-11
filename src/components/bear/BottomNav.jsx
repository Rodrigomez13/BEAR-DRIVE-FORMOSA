import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function BottomNav({ items, basePath }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="shrink-0 z-40 glass-navy border-t border-white/10">
      <div className="max-w-md mx-auto flex items-stretch px-2 safe-bottom">
        {items.map((item) => {
          const active = location.pathname === `${basePath}/${item.path}` || (item.path === "" && location.pathname === basePath);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path === "" ? basePath : `${basePath}/${item.path}`)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors duration-200"
            >
              {active && (
                <motion.div
                  layoutId={`nav-pill-${basePath}`}
                  className="absolute inset-x-2 top-1 bottom-1 rounded-xl bg-accent/15"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative p-1.5 rounded-xl transition-colors ${active ? "text-accent" : "text-white/50 hover:text-white/80"}`}
              >
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              </motion.div>
              <span className={`relative text-[10px] font-medium transition-colors ${active ? "text-accent" : "text-white/50"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}