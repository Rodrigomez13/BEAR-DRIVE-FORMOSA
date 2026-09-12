import React from "react";
import BottomNav from "@/components/bear/BottomNav";
import AnimatedOutlet from "@/components/bear/AnimatedOutlet";
import { Car, Activity, DollarSign, User } from "lucide-react";

export default function DriverShell() {
  const items = [
    { path: "", label: "Conducir", icon: Car },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "earnings", label: "Ganancias", icon: DollarSign },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return (
    <div className="app-screen h-[100dvh] overflow-hidden flex flex-col bg-background">
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatedOutlet />
      </main>
      <BottomNav items={items} basePath="/driver" />
    </div>
  );
}