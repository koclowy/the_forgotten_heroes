"use client";
import { motion, type Transition } from "motion/react";
import { useRef, useState } from "react";
import type { RocketPose } from "./config";
import { ScaledImg, useScaleLevel, type Scaled } from "./ScaledImg";

const keyOf = (p: RocketPose) => `${p.left},${p.top},${p.w},${p.rotate}`;
/** crossfade between the resting and the boosters image */
const SWAP = { duration: 0.15, ease: "easeInOut" } as const;

/**
 * Rocket artwork comes from assets.json → images.rocket (resting) and images.rocketBoost
 * (boosters firing). Both pointing straight up, on the SAME canvas so they line up.
 * The boosters version shows while the rocket moves between poses, and while `boost` is set
 * (hovering an explorable planet). Otherwise the resting version.
 */
export function Rocket({
  pose,
  initial,
  transition,
  float,
  tilt = 0,
  src,
  boostSrc,
  boost = false,
  hidden = false,
}: {
  pose: RocketPose;
  initial?: RocketPose;
  transition: Transition;
  float: boolean;
  tilt?: number;
  src?: Scaled;
  boostSrc?: Scaled;
  /** show the boosters while standing still too ("ready to launch") */
  boost?: boolean;
  hidden?: boolean;
}) {
  const toStyle = (p: RocketPose) => ({
    left: `${p.left}%`,
    top: `${p.top}%`,
    width: `${p.w}%`,
    rotate: p.rotate,
  });

  // moving = the pose it last finished animating to isn't the current one
  const key = keyOf(pose);
  const keyRef = useRef(key);
  keyRef.current = key;
  const [settled, setSettled] = useState<string | null>(initial ? null : key);
  const firing = !!boostSrc && (boost || settled !== key);

  // both layers share one canvas, so they use the same resolution level
  const restRef = useRef<HTMLImageElement>(null);
  const level = useScaleLevel(restRef, src, "width");

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{ x: "-50%", y: "-50%", zIndex: 5 }}
      initial={initial ? toStyle(initial) : false}
      animate={{ ...toStyle(pose), opacity: hidden ? 0 : 1 }}
      transition={{ ...transition, opacity: { duration: 0.6 } }}
      onAnimationComplete={() => setSettled(keyRef.current)}
    >
      <motion.div
        className="relative"
        animate={float ? { y: [0, -8, 0], rotate: tilt } : { y: 0, rotate: tilt }}
        transition={
          float
            ? { y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }, rotate: { type: "spring", stiffness: 120, damping: 14 } }
            : { type: "spring", stiffness: 120, damping: 14 }
        }
      >
        {/* resting rocket stays opaque underneath; the boosters version fades in on top of it */}
        <ScaledImg ref={restRef} src={src} level={level} alt="" className="block w-full" draggable={false} />
        {boostSrc && (
          <motion.div className="absolute inset-0" initial={false} animate={{ opacity: firing ? 1 : 0 }} transition={SWAP}>
            <ScaledImg src={boostSrc} level={level} alt="" className="block h-full w-full" draggable={false} />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
