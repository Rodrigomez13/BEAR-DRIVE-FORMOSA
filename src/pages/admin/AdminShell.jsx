import React from "react";
import { Outlet, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LayoutDashboard, Users, DollarSign, LogOut } from "lucide-react";
import Logo from "@/components/bear/Logo";

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user?.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/drivers", label: "Conductores", icon: Users },
    { path: "/admin/pricing", label: "Tarifas", icon: DollarSign },
  ];

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col md:flex-row bg-secondary/30">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bear-gradient text-white flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <Logo size="sm" className="[&_span]:text-white" />
          <p className="text-[14px] text-white/50 mt-2">Panel Operations</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors no-select ${active ? "bg-accent text-foreground font-semibold" : "text-white/70 hover:bg-white/10"}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={() => logout()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 no-select">
            <LogOut className="w-4 h-4" />Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden bear-gradient text-white px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide safe-top">
        <Logo size="sm" className="[&_span]:text-white shrink-0" />
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap no-select ${active ? "bg-accent text-foreground font-semibold" : "text-white/70"}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
        <button onClick={() => logout()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-white/70 whitespace-nowrap no-select ml-auto">
          <LogOut className="w-4 h-4" />Salir
        </button>
      </div>

      {/* Main */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}