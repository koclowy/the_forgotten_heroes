"use client";
import { motion, type Transition } from "motion/react";
import { useRef } from "react";
import { COLORS, EQUIPMENT_ART_SCALE_ZOOMED, QUICK, type FramePose } from "./config";
import { sound } from "../../audio/sound";
import type { Equipment } from "../../content/load";
import { ScaledImg } from "./ScaledImg";

const toStyle = (p: FramePose) => ({
  left: `${p.left}%`,
  top: `${p.top}%`,
  width: `${p.w}%`,
  height: `${p.h}%`,
  rotate: p.rotate,
});

export function EquipmentFrame({
  item,
  index,
  pose,
  from,
  focused,
  interactive,
  hovered,
  onHover,
  onSelect,
  completed = false,
  glow = false,
  exitTo,
  delay = 0.3,
}: {
  item: Equipment;
  index: number;
  pose: FramePose;
  /** pose to rise from on mount / sink back into on exit */
  from: FramePose;
  focused: boolean;
  interactive: boolean;
  hovered: boolean;
  onHover: (on: boolean) => void;
  onSelect: () => void;
  /** shows a ✓ badge */
  completed?: boolean;
  /** pulsing glow (bonus equipment) */
  glow?: boolean;
  /** pose to leave to (defaults to `from`) */
  exitTo?: FramePose;
  /** first-appearance delay (s) */
  delay?: number;
}) {
  // first appearance waits for the planet zoom, then staggers in
  const firstRun = useRef(true);
  const transition: Transition = firstRun.current
    ? { ...QUICK, delay: delay + index * 0.08 }
    : QUICK;
  const artScale = EQUIPMENT_ART_SCALE_ZOOMED * item.imageScale;

  return (
    <motion.div
      className="absolute"
      style={{ x: "-50%", y: "-50%", zIndex: focused ? 4 : 3 }}
      initial={{ ...toStyle(from), opacity: 0 }}
      animate={{ ...toStyle(pose), opacity: 1 }}
      exit={{ ...toStyle(exitTo ?? from), opacity: 0, transition: { ...QUICK, duration: 0.7 } }}
      transition={transition}
      onAnimationComplete={() => (firstRun.current = false)}
    >
      <motion.button
        type="button"
        aria-label={item.name}
        tabIndex={interactive ? 0 : -1}
        disabled={!interactive}
        onPointerEnter={() => interactive && (onHover(true), sound.play("buttons.hover", { minGap: 120 }))}
        onPointerLeave={() => interactive && onHover(false)}
        onFocus={() => interactive && onHover(true)}
        onBlur={() => interactive && onHover(false)}
        onClick={() => interactive && onSelect()}
        className="relative block h-full w-full outline-none"
        data-clickable={interactive ? "" : undefined}
        style={{ pointerEvents: interactive ? "auto" : "none" }}
        animate={{ scale: hovered ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <span
          className="absolute inset-0 overflow-hidden"
          style={{
            border: `max(3px, 0.55cqw) solid ${COLORS.gold}`,
            background: "rgba(20,26,58,.35)",
          }}
        >
          {item.image && (
            // zoomed in: only the drawing grows (same spring + timing as the frame, so it's one motion)
            <motion.span
              className="block h-full w-full"
              initial={false}
              animate={{ scale: focused ? artScale : 1 }}
              transition={transition}
            >
              <ScaledImg
                src={item.image}
                fit="contain"
                extra={artScale}
                alt=""
                draggable={false}
                className="h-full w-full object-contain p-[6%]"
              />
            </motion.span>
          )}
        </span>

        {/* dashed hover outline */}
        <motion.svg
          className="pointer-events-none absolute overflow-visible"
          style={{ inset: "-13%" }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          initial={false}
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.9 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          <motion.rect
            x="0"
            y="0"
            width="100"
            height="100"
            fill="none"
            stroke={COLORS.gold}
            strokeWidth={5}
            strokeDasharray="10 8"
            vectorEffect="non-scaling-stroke"
            animate={{ strokeDashoffset: [0, -36] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        </motion.svg>
      </motion.button>

      {/* bonus glow */}
      {glow && (
        <motion.span
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ boxShadow: `0 0 3cqw 1cqw ${COLORS.hover}` }}
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* completed badge (counter-rotated so the tick stays upright) */}
      {completed && (
        <motion.span
          className="pointer-events-none absolute grid place-items-center rounded-full text-white"
          style={{
            right: 0,
            top: 0,
            x: "40%",
            y: "-40%",
            width: "2.2cqw",
            height: "2.2cqw",
            fontSize: "1.2cqw",
            background: COLORS.correct,
            border: "2px solid #fff",
            rotate: -pose.rotate,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: focused ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.4 }}
        >
          ✓
        </motion.span>
      )}

    </motion.div>
  );
}
