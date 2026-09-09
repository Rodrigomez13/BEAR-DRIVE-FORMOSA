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
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <BottomNav items={items} basePath="/passenger" />
    </div>
  );
}