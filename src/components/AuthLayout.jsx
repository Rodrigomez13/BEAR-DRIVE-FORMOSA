import React from "react";
import ThemeToggle from "@/components/bear/ThemeToggle";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="relative min-h-[100dvh] overflow-y-auto scrollbar-hide flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-background to-secondary/40">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md my-auto">
        {/* Encabezado de Marca Oficial con Mascota 3D */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-accent/30 to-amber-500/10 p-1 shadow-lg shadow-accent/10 flex items-center justify-center border border-accent/40">
              <img
                src="/assets/mascot/frame_01.png"
                alt="Mascota BearDrive"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>
            {Icon && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-foreground flex items-center justify-center shadow-md border-2 border-background">
                <Icon className="w-4 h-4" />
              </div>
            )}
          </div>

          <img
            src="/assets/beardrive_logo_slogan.png"
            alt="BearDrive - Compartiendo Destinos"
            className="h-10 w-auto object-contain mb-2"
          />

          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{subtitle}</p>}
        </div>

        {/* Tarjeta de Formulario Glassmorphism */}
        <div className="bg-card/90 backdrop-blur-md rounded-3xl shadow-xl border border-border/80 p-6 sm:p-7">
          {children}
        </div>

        {footer && (
          <p className="text-center text-xs text-muted-foreground mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}