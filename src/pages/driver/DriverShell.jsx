import React from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "@/components/bear/BottomNav";
import { Car, Activity, DollarSign, User } from "lucide-react";

export default function DriverShell() {
  const items = [
    { path: "", label: "Conducir", icon: Car },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "earnings", label: "Ganancias", icon: DollarSign },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-background">
      <main className="flex-1 overflow-y-auto scrollbar-hide relative">
        <Outlet />
      </main>
      <BottomNav items={items} basePath="/driver" />
    </div>
  );
}