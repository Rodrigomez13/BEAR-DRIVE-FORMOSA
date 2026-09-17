import React from "react";
import { Star } from "lucide-react";

export default function StarRating({ value = 0, onChange = undefined, size = 16, readOnly = false }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(n)}
          className={`${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
        >
          <Star
            size={size}
            className={n <= Math.round(value) ? "fill-accent text-accent" : "text-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
}