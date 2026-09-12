import React, { useRef, useCallback } from "react";
import { Image } from "@/components/ui/image";
import { BEAR_LOGO_SVG } from "@/lib/brandAssets";

// BearDrive logo. Renders the full SVG logo (icon + wordmark) at its natural
// aspect ratio — width-driven, never cropped. Supports long-press (>=2.5s)
// to trigger the hidden admin access.
export default function Logo({ size = "md", onLongPress, className = "" }) {
  const timerRef = useRef(null);
  const triggeredRef = useRef(false);

  const sizes = {
    sm: "w-20",
    md: "w-28",
    lg: "w-40",
    xl: "w-52",
  };
  const width = sizes[size] || sizes.md;

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
      <Image
        src={BEAR_LOGO_SVG}
        alt="BearDrive"
        className={`block ${width} h-auto object-contain`}
      />
    </div>
  );
}