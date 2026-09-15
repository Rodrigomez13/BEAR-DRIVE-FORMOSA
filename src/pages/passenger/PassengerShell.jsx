import React from "react";
import MobileAppShell from "@/components/layout/MobileAppShell";
import { Navigation, Activity, Gift, User } from "lucide-react";

export default function PassengerShell() {
  const items = [
    { path: "", label: "Viajar", icon: Navigation },
    { path: "activity", label: "Actividad", icon: Activity },
    { path: "benefits", label: "Beneficios", icon: Gift },
    { path: "profile", label: "Perfil", icon: User },
  ];
  return <MobileAppShell items={items} basePath="/passenger" />;
}
