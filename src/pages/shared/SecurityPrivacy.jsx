import React from "react";
import { Card } from "@/components/ui/card";
import { Shield, Lock, MapPin, Eye, Bell, FileText, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SECTIONS = [
  { icon: Lock, title: "Contraseña y acceso", desc: "Tu cuenta está protegida con tu contraseña. Podés restablecerla desde la opción \"¿Olvidaste tu contraseña?\" en el inicio de sesión." },
  { icon: MapPin, title: "Ubicación en tiempo real", desc: "Compartimos tu ubicación con el conductor o pasajero solo durante el viaje activo. Al finalizar, dejamos de rastrear tu posición." },
  { icon: Eye, title: "Visibilidad de tu perfil", desc: "Tu nombre y calificación son visibles durante un viaje. Tu DNI y teléfono nunca se muestran públicamente." },
  { icon: Bell, title: "Notificaciones", desc: "Recibís notificaciones sobre el estado de tus viajes, promociones y novedades. Podés desactivarlas desde la configuración de tu dispositivo." },
  { icon: FileText, title: "Datos personales", desc: "Cumplimos con la Ley 25.326 de Protección de Datos Personales. Podés solicitar acceso, rectificación o supresión de tus datos contactando a soporte." },
  { icon: Shield, title: "Verificación de identidad", desc: "Validamos DNI y antecedentes de los conductores para garantizar la seguridad de la comunidad BearDrive." },
];

export default function SecurityPrivacy() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background">
      <div className="max-w-md mx-auto px-5 pt-8 pb-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ChevronLeft className="w-4 h-4" />Volver
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Seguridad y privacidad</h1>
            <p className="text-sm text-muted-foreground">Cómo protegemos tus datos</p>
          </div>
        </div>
        <div className="space-y-3">
          {SECTIONS.map((s, i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}