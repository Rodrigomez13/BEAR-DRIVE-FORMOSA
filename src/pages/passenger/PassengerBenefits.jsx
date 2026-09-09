import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Gift, Star } from "lucide-react";

export default function PassengerBenefits() {
  const { user } = useAuth();
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Benefit.filter({ enabled: true, audience: "passenger" });
        const allData = await base44.entities.Benefit.filter({ enabled: true, audience: "all" });
        setBenefits([...data, ...allData]);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10">
      <h1 className="text-2xl font-bold mb-2">Beneficios</h1>
      <p className="text-sm text-muted-foreground mb-6">Acumulá BearPoints y canjealos por descuentos</p>

      <Card className="p-5 mb-6 bear-gold-gradient text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">Tus BearPoints</p>
            <p className="text-4xl font-extrabold">{user?.bearpoints_balance || 0}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-foreground/10 flex items-center justify-center">
            <Star className="w-7 h-7" />
          </div>
        </div>
        <p className="text-xs opacity-70 mt-3">Ganás 10 BearPoints por cada viaje completado</p>
      </Card>

      <h2 className="font-semibold mb-3">Beneficios disponibles</h2>
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando...</div>
      ) : benefits.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay beneficios disponibles por ahora</p>
        </div>
      ) : (
        <div className="space-y-3">
          {benefits.map((b) => (
            <Card key={b.id} className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Gift className="w-7 h-7 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{b.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                {b.partner && <p className="text-xs text-accent font-medium mt-1">{b.partner}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{b.points_cost} pts</p>
                <p className="text-sm font-bold text-accent">{b.discount_text}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}