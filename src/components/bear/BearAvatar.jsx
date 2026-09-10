import React from "react";
import { Image } from "@/components/ui/image";
import { BEAR_MASCOT_STAND } from "@/lib/brandAssets";

// Reusable avatar: shows the user's profile photo, or the BearDrive mascot as default.
export default function BearAvatar({ photoUrl, size = 64, className = "" }) {
  const src = photoUrl || BEAR_MASCOT_STAND;
  return (
    <Image
      src={src}
      fittingType="fill"
      style={{ width: size, height: size }}
      className={`rounded-full overflow-hidden shrink-0 bg-[#0e1320] ${className}`}
    />
  );
}