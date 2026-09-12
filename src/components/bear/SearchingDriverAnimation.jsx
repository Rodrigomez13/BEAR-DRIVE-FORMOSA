import React from "react";

const SEARCHING_GIF = "https://media.base44.com/images/public/6aa1902bd90ac5b66092d80d/821ccfd93_oso-gif-cuadrado-bg-azuloscuro.gif";

export default function SearchingDriverAnimation({ size = 140 }) {
  return (
    <img
      src={SEARCHING_GIF}
      alt="Buscando conductor"
      className="mx-auto mb-2 object-contain rounded-2xl"
      style={{ width: size, height: size }}
    />
  );
}