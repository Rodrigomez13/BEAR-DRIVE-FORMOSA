import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function BottomNav({ items, basePath }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="shrink-0 z-40 glass-navy border-t border-white/10">
      <div className="max-w-md mx-auto flex items-center justify-evenly px-1 py-1.5 safe-bottom">
        {items.map((item) => {
          const active = location.pathname === `${basePath}/${item.path}` || (item.path === "" && location.pathname === basePath);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path === "" ? basePath : `${basePath}/${item.path}`)}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
                active ? "text-accent" : "text-white/50 hover:text-white/80"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}