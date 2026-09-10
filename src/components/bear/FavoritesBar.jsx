import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Star, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function FavoritesBar({ onSelect }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);

  const load = async () => {
    try {
      const favs = await base44.entities.FavoritePlace.list("-created_date", 10);
      setFavorites(favs);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const handleDelete = async (id) => {
    try {
      await base44.entities.FavoritePlace.delete(id);
      setFavorites(f => f.filter(fav => fav.id !== id));
      toast({ title: "Favorito eliminado" });
    } catch {
      toast({ title: "No se pudo eliminar", variant: "destructive" });
    }
  };

  if (favorites.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {favorites.map((f) => (
        <div
          key={f.id}
          className="shrink-0 flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium"
        >
          <button
            onClick={() => onSelect({ lat: f.lat, lng: f.lng, label: f.label, address: f.address })}
            className="flex items-center gap-1.5"
          >
            <Star className="w-3 h-3 fill-accent" />
            {f.label}
          </button>
          <button
            onClick={() => handleDelete(f.id)}
            className="p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}