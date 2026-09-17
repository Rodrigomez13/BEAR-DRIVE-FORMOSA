import React, { useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Download } from "lucide-react";

const DISMISS_KEY = "pwa_install_dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaInstallPrompt() {
  const { user } = useAuth();
  const deferredPrompt = useRef(null);
  const shownRef = useRef(false);

  // Always capture the install prompt event, even before login
  useEffect(() => {
    if (isStandalone()) return;
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { deferredPrompt.current = null; });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show toast after login
  useEffect(() => {
    if (!user || shownRef.current) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") { shownRef.current = true; return; }

    const showToast = () => {
      if (shownRef.current) return;
      shownRef.current = true;

      if (deferredPrompt.current) {
        const t = toast({
          title: "Instalá BearDrive",
          description: "Accedé más rápido desde tu pantalla de inicio.",
          duration: 15000,
          action: (
            <ToastAction
              altText="Instalar BearDrive"
              onClick={async () => {
                const p = deferredPrompt.current;
                if (!p) return;
                p.prompt();
                const { outcome } = await p.userChoice;
                deferredPrompt.current = null;
                t.dismiss();
                if (outcome === "accepted") {
                  toast({ title: "¡Instalada! 🐻", description: "BearDrive se agregó a tu pantalla de inicio." });
                } else {
                  localStorage.setItem(DISMISS_KEY, "true");
                }
              }}
              className="bear-gold-gradient text-foreground border-0"
            >
              <Download className="w-4 h-4 mr-1 inline" /> Instalar
            </ToastAction>
          ),
        });
      } else if (isIOS()) {
        toast({
          title: "Instalá BearDrive",
          description: "Tocá Compartir ⊕ y elegí 'Agregar a pantalla de inicio'.",
          duration: 15000,
        });
      }
    };

    // Brief delay to let beforeinstallprompt fire if it hasn't yet
    const timer = setTimeout(showToast, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  return null;
}