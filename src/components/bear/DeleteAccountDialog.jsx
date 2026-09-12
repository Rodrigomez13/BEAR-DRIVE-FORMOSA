import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";

export default function DeleteAccountDialog({ open, onOpenChange }) {
  const { logout } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke("deleteUserAccount", {});
      await logout();
      window.location.href = "/login";
    } catch (err) {
      toast({ title: "No se pudo eliminar la cuenta", description: err.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Eliminar cuenta
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es permanente. Se borrarán tu cuenta, tus viajes, calificaciones, favoritos, documentos, vehículos y todos tus datos. No podrás recuperarlos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>
            ) : (
              "Sí, eliminar cuenta"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}