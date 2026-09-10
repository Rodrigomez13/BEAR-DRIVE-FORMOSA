import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all duration-200 ${
                active ? "text-accent" : "text-white/50 hover:text-white/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-accent/15 scale-110" : ""}`}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}