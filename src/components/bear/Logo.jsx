import React, { useRef, useCallback } from "react";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_SVG } from "@/lib/brandAssets";

// BearDrive logo lockup: transparent SVG icon + wordmark below.
// Square container with object-contain ensures the icon is never cropped.
// Supports long-press (>=2.5s) to trigger the hidden admin access.
export default function Logo({ size = "md", onLongPress, className = "" }) {
  const timerRef = useRef(null);

  const sizes = {
    sm: { box: "w-9 h-9", text: "text-base" },
    md: { box: "w-14 h-14", text: "text-xl" },
    lg: { box: "w-20 h-20", text: "text-3xl" },
    xl: { box: "w-24 h-24", text: "text-4xl" },
  };
  const s = sizes[size] || sizes.md;

  const startPress = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (onLongPress) onLongPress();
    }, 2500);
  }, [onLongPress]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <div
      className={`select-none ${className}`}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={`${s.box} flex items-center justify-center`}>
          <Image src={BEAR_LOGO_SVG} alt="BearDrive" className="w-full h-full object-contain" />
        </div>
        <span className={`${s.text} font-extrabold tracking-tight text-foreground leading-none`}>
          Bear<span className="text-accent">Drive</span>
        </span>
      </div>
    </div>
  );
}