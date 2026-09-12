import React from "react";

const SEARCHING_GIF = "https://media.base44.com/images/public/6aa1902bd90ac5b66092d80d/7afaf3202_beardrive-gif-loocking.gif";

export default function SearchingDriverAnimation({ size = 140 }) {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
        <defs>
          <filter id="bear-remove-white">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 -1 0 1"
            />
            <feComponentTransfer>
              <feFuncA type="linear" slope="3" intercept="-0.5" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
      <div
        className="mx-auto mb-2 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size, backgroundColor: "#0e1120" }}
      >
        <img
          src={SEARCHING_GIF}
          alt="Buscando conductor"
          crossOrigin="anonymous"
          className="object-contain"
          style={{ width: size, height: size, filter: "url(#bear-remove-white)" }}
        />
      </div>
    </>
  );
}