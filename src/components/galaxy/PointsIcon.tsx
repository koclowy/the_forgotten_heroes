"use client";
/**
 * The research-points icon (assets/image/research_points/{x}/…), sized to the text it sits in
 * (1em = the surrounding font size). Falls back to the old gold star if there's no image.
 */
import { createContext, useContext, type CSSProperties } from "react";
import type { Scaled } from "../../content/assets";
import { COLORS } from "./config";
import { ScaledImg } from "./ScaledImg";

export const PointsIconContext = createContext<Scaled | undefined>(undefined);

export function PointsIcon({ size = "1.15em", label = "research points", style }: { size?: string; label?: string; style?: CSSProperties }) {
  const src = useContext(PointsIconContext);
  const box: CSSProperties = { width: size, height: size, display: "inline-block", verticalAlign: "-0.2em", flexShrink: 0, ...style };
  return src ? (
    <ScaledImg src={src} fit="contain" alt={label} draggable={false} style={{ ...box, objectFit: "contain" }} />
  ) : (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} style={box}>
      <path d="M12 2 15 9l7 .6-5.3 4.6L18.3 21 12 17.3 5.7 21l1.6-6.8L2 9.6 9 9z" fill={COLORS.gold} />
    </svg>
  );
}
