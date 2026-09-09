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
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <BottomNav items={items} basePath="/driver" />
    </div>
  );
}