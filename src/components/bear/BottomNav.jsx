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
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors duration-200 ${
                active ? "text-accent" : "text-white/50 hover:text-white/80"
              }`}
            >
              <div className="relative p-1.5 flex items-center justify-center">
                {active && (
                  <motion.div
                    layoutId={`navActive-${basePath}`}
                    className="absolute inset-0 bg-accent/15 rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon
                  className={`relative w-5 h-5 transition-transform duration-200 ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}