import React from "react";
import BottomNav from "@/components/bear/BottomNav";
import AnimatedOutlet from "@/components/bear/AnimatedOutlet";
import { Navigation, Activity, Gift, User } from "lucide-react";

export default function PassengerShell() {
  const items = [
    { path: "", label: "Viajar", icon: Navigation },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "benefits", label: "Beneficios", icon: Gift },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return (
    <div className="app-screen h-[100dvh] overflow-hidden flex flex-col bg-background">
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatedOutlet />
      </main>
      <BottomNav items={items} basePath="/passenger" />
    </div>
  );
}