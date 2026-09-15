import React from "react";
import MobileAppShell from "@/components/layout/MobileAppShell";
import { Car, Activity, DollarSign, User } from "lucide-react";

export default function DriverShell() {
  const items = [
    { path: "", label: "Conducir", icon: Car },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "earnings", label: "Ganancias", icon: DollarSign },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return <MobileAppShell items={items} basePath="/driver" />;
}
