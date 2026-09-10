import React, { useRef, useCallback } from "react";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_MARK } from "@/lib/brandAssets";

// BearDrive logo. Supports long-press (>=2.5s) to trigger the hidden admin access.
export default function Logo({ size = "md", onLongPress, className = "" }) {
  const timerRef = useRef(null);
  const triggeredRef = useRef(false);

  const sizes = {
    sm: { box: "w-9 h-9", text: "text-lg" },
    md: { box: "w-12 h-12", text: "text-2xl" },
    lg: { box: "w-20 h-20", text: "text-4xl" },
    xl: { box: "w-28 h-28", text: "text-5xl" }
  };
  const s = sizes[size] || sizes.md;

  const startPress = useCallback(() => {
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
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
      <div className="flex flex-col items-center gap-3">
        <div className={`${s.box} rounded-2xl overflow-hidden`}>
          <Image src={BEAR_LOGO_MARK} fittingType="fit" className="block w-full h-full" />
        </div>
        <div className="text-center leading-none">
          <span className={`${s.text} font-extrabold tracking-tight text-foreground`}>
            Bear<span className="text-accent">Drive</span>
          </span>
        </div>
      </div>
    </div>
  );
}