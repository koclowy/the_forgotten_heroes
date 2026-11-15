"use client";
import { motion, type Transition } from "motion/react";
import { sound } from "../../audio/sound";
import { COLORS, type Box, type PlanetId } from "./config";
import { ScaledImg, type Scaled } from "./ScaledImg";

/** Flat colours from your screen-2 prototype. */
const FLAT: Record<PlanetId, string> = {
  earth: "#2D4BFF",
  moon: "#D9D9D9",
  mars: "#E65024",
};

/** Softer, painterly look used on the title screen. */
const TITLE_LOOK: Record<PlanetId, string> = {
  earth:
    "radial-gradient(ellipse 70% 55% at 50% 4%, #2f55ff 0%, #1d2fae 38%, #17205e 62%, #161936 80%)",
  moon: "radial-gradient(circle at 50% 78%, #ffffff 0%, #d6d4e2 38%, #a9a5c4 78%, #8f89b0 100%)",
  mars: "linear-gradient(180deg, rgba(120,60,110,0) 0%, rgba(130,60,90,.45) 42%, #c24a3a 78%, #e2583a 100%)",
};

export type PlanetLook = "title" | "flat" | "surface";

export function Planet({
  id,
  box,
  initial,
  transition,
  look,
  float,
  hovered,
  interactive,
  onHover,
  onSelect,
  label,
  image,
  color,
  hidden = false,
  caption,
}: {
  id: PlanetId;
  box: Box;
  initial?: Box;
  transition: Transition;
  look: PlanetLook;
  float: boolean;
  hovered: boolean;
  interactive: boolean;
  onHover?: (on: boolean) => void;
  onSelect?: () => void;
  label: string;
  /** optional artwork (x1/x2/x3) — replaces the drawn circle */
  image?: Scaled;
  /** flat colour override (from planets.json) */
  color?: string;
  /** fade out but keep position (intro / ending screens) */
  hidden?: boolean;
  /** small caption under the planet, e.g. "2 / 3 ✓" */
  caption?: string;
}) {
  const toStyle = (b: Box) => ({ left: `${b.left}%`, top: `${b.top}%`, width: `${b.w}%` });
  const fade = { duration: 0.8, ease: "easeInOut" } as const;

  return (
    <motion.div
      className="absolute"
      style={{ x: "-50%", y: "-50%", zIndex: look === "surface" ? 1 : 2 }}
      initial={initial ? toStyle(initial) : false}
      animate={{ ...toStyle(box), opacity: hidden ? 0 : 1 }}
      transition={{ ...transition, opacity: { duration: 0.7, ease: "easeInOut" } }}
    >
      {/* idle bob — only on the title screen */}
      <motion.div
        animate={float ? { y: [0, -10, 0] } : { y: 0 }}
        transition={
          float
            ? { duration: 6 + id.length, repeat: Infinity, ease: "easeInOut", delay: 2 }
            : { duration: 0.6 }
        }
        className="relative"
      >
        <motion.button
          type="button"
          aria-label={label}
          tabIndex={interactive ? 0 : -1}
          disabled={!interactive}
          onPointerEnter={() => interactive && (onHover?.(true), sound.play("buttons.hover", { minGap: 120 }))}
          onPointerLeave={() => interactive && onHover?.(false)}
          onFocus={() => interactive && onHover?.(true)}
          onBlur={() => interactive && onHover?.(false)}
          onClick={() => interactive && onSelect?.()}
          animate={{ scale: hovered ? 1.04 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative block aspect-square w-full rounded-full outline-none"
          data-clickable={interactive ? "" : undefined}
          style={{ pointerEvents: interactive ? "auto" : "none" }}
        >
          {/* glow (title + surface) */}
          <motion.span
            className="absolute inset-0 rounded-full"
            animate={{ opacity: look === "flat" ? 0 : 1 }}
            transition={fade}
            style={{
              boxShadow:
                id === "moon"
                  ? "0 0 6cqw 0.6cqw rgba(255,255,255,.22)"
                  : id === "earth"
                    ? "0 -0.5cqw 6cqw 0.5cqw rgba(45,75,255,.35)"
                    : "0 0 6cqw 0.5cqw rgba(230,80,36,.25)",
            }}
          />
          {image ? (
            <ScaledImg src={image} fit="cover" alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-full object-cover" />
          ) : (
            <>
          {/* flat fill (screen 2) */}
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: color ?? FLAT[id] }}
            animate={{ opacity: look === "title" && id !== "moon" ? 0 : 1 }}
            transition={fade}
          />
          {/* title-screen painterly fill, cross-fades out */}
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: TITLE_LOOK[id] }}
            animate={{ opacity: look === "title" ? 1 : 0 }}
            transition={fade}
          />
            </>
          )}
          {/* surface shading for screen 3 (lit top, darker lower band) */}
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,.06) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,.18) 28%, rgba(0,0,0,.22) 40%)",
            }}
            animate={{ opacity: look === "surface" ? 1 : 0 }}
            transition={fade}
          />
        </motion.button>

        {/* yellow dashed hover ring */}
        <motion.svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute"
          style={{ inset: "-16%" }}
          initial={false}
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.85 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <motion.circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke={COLORS.hover}
            strokeWidth={3}
            strokeDasharray="10 7"
            vectorEffect="non-scaling-stroke"
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50px 50px" }}
          />
        </motion.svg>

        {/* progress caption */}
        <motion.div
          className="pointer-events-none absolute left-1/2 whitespace-nowrap text-center"
          // below the hover ring (it reaches 16 % past the planet) + a small gap
          style={{ top: "121%", x: "-50%", fontSize: "1.15cqw", color: "#fff" }}
          initial={false}
          animate={{ opacity: caption ? 1 : 0, y: caption ? 0 : -6 }}
          transition={{ duration: 0.4, delay: caption ? 0.6 : 0 }}
        >
          {caption}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
