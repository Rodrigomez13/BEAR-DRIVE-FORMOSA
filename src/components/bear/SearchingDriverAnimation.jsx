import React from "react";

const SEARCHING_GIF = "https://media.base44.com/images/public/6aa1902bd90ac5b66092d80d/7afaf3202_beardrive-gif-loocking.gif";

export default function SearchingDriverAnimation({ size = 140 }) {
  return (
    <img
      src={SEARCHING_GIF}
      alt="Buscando conductor"
      className="mx-auto mb-2 object-contain rounded-2xl mix-blend-multiply"
      style={{ width: size, height: size }}
    />
  );
}