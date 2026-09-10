import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Star } from "lucide-react";

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

  if (favorites.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {favorites.map((f) => (
        <button
          key={f.id}
          onClick={() => onSelect({ lat: f.lat, lng: f.lng, label: f.label, address: f.address })}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
        >
          <Star className="w-3 h-3 fill-accent" />
          {f.label}
        </button>
      ))}
    </div>
  );
}