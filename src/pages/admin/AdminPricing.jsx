import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Save, Loader2, DollarSign } from "lucide-react";

export default function AdminPricing() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.PricingConfig.filter({ active: true });
        setConfig(data[0] || null);
      } catch (err) {} finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.PricingConfig.update(config.id, {
        base_fare: parseFloat(config.base_fare),
        per_km: parseFloat(config.per_km),
        per_min: parseFloat(config.per_min),
        min_fare: parseFloat(config.min_fare),
        flash_supplement: parseFloat(config.flash_supplement),
        premium_multiplier: parseFloat(config.premium_multiplier),
      });
      toast({ title: "Tarifas actualizadas" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!config) return <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No hay configuración de tarifas</p></Card>;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Tarifas</h1>
      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-accent" />
          <p className="font-semibold">Configuración de tarifas — {config.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Tarifa base (ARS)</Label>
            <Input type="number" value={config.base_fare} onChange={e => setConfig({ ...config, base_fare: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Por km (ARS)</Label>
            <Input type="number" value={config.per_km} onChange={e => setConfig({ ...config, per_km: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Por minuto (ARS)</Label>
            <Input type="number" value={config.per_min} onChange={e => setConfig({ ...config, per_min: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tarifa mínima (ARS)</Label>
            <Input type="number" value={config.min_fare} onChange={e => setConfig({ ...config, min_fare: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Suplemento Flash (ARS)</Label>
            <Input type="number" value={config.flash_supplement} onChange={e => setConfig({ ...config, flash_supplement: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Multiplicador Premium</Label>
            <Input type="number" step="0.1" value={config.premium_multiplier} onChange={e => setConfig({ ...config, premium_multiplier: e.target.value })} />
          </div>
        </div>

        <div className="bg-secondary/30 rounded-xl p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Ejemplo de cálculo</p>
          <p>Para un viaje de 5 km y 12 min (Básico):</p>
          <p className="font-semibold text-accent mt-1">
            ${Math.round((parseFloat(config.base_fare) + 5 * parseFloat(config.per_km) + 12 * parseFloat(config.per_min))).toLocaleString("es-AR")}
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bear-gold-gradient text-foreground border-0">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar tarifas</>}
        </Button>
      </Card>
    </div>
  );
}