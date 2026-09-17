import React from "react";
import MobileAppShell from "@/components/layout/MobileAppShell";
import { Navigation, Activity, Wallet, User } from "lucide-react";

export default function PassengerShell() {
  const items = [
    { path: "", label: "Viajar", icon: Navigation },
    { path: "rides", label: "Viajes", icon: Activity },
    { path: "wallet", label: "Billetera", icon: Wallet },
    { path: "account", label: "Cuenta", icon: User },
  ];
  return <MobileAppShell items={items} basePath="/passenger" />;
}
