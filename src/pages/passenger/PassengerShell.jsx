import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/bear/BottomNav";
import { Navigation, Activity, Gift, User } from "lucide-react";

export default function PassengerShell() {
  const items = [
    { path: "", label: "Viajar", icon: Navigation },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "benefits", label: "Beneficios", icon: Gift },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-background">
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
      <BottomNav items={items} basePath="/passenger" />
    </div>
  );
}