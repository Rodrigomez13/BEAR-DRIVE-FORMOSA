import React from "react";
import { Image } from "@/components/ui/image";
import { BEAR_MASCOT_STAND } from "@/lib/brandAssets";

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <Image src={BEAR_MASCOT_STAND} fittingType="fit" className="w-24 h-24 mb-4 opacity-80" />
      {Icon && <Icon className="w-8 h-8 text-accent mb-3" />}
      <p className="font-semibold text-sm mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}