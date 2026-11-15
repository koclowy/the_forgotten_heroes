"use client";
/** Top-right points counter. Counts up and floats a "+N" when points are earned. */
import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { COLORS } from "./config";
import { PointsIcon } from "./PointsIcon";

export function PointsHud({
  points,
  goal,
  visible,
  highlight,
}: {
  points: number;
  goal: number;
  visible: boolean;
  /** pulse + glow (when the scientist points at it) */
  highlight: boolean;
}) {
  const [shown, setShown] = useState(points);
  const [gain, setGain] = useState<{ id: number; n: number } | null>(null);
  const prev = useRef(points);

  useEffect(() => {
    const from = prev.current;
    prev.current = points;
    if (points === from) return;
    if (points > from) setGain({ id: Date.now(), n: points - from });
    const c = animate(from, points, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [points]);

  const full = points >= goal && goal > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="hud"
          data-no-advance
          className="absolute z-[30] flex items-center rounded-full"
          style={{
            right: "2.4%",
            top: "4.2%",
            gap: "0.6cqw",
            padding: "0.55cqw 1.4cqw 0.55cqw 0.9cqw",
            border: `max(2px,0.28cqw) solid ${COLORS.gold}`,
            background: "rgba(22,26,51,.7)",
            color: COLORS.gold,
            fontSize: "1.45cqw",
          }}
          initial={{ opacity: 0, y: -20, scale: 0.8 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: highlight ? [1, 1.12, 1] : 1,
            boxShadow: highlight || full ? `0 0 2.2cqw ${COLORS.gold}aa` : "0 0 0 #0000",
          }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            scale: highlight ? { duration: 1, repeat: Infinity } : { duration: 0.3 },
          }}
          role="status"
          aria-label={`${points} of ${goal} Research Points`}
          title={`${points} / ${goal} Research Points`}
        >
          <motion.span
            className="grid place-items-center"
            style={{ width: "1.8cqw", height: "1.8cqw" }}
            animate={gain ? { rotate: [0, 360] } : {}}
            key={gain?.id ?? 0}
            transition={{ duration: 0.8 }}
          >
            <PointsIcon size="1.8cqw" label="" style={{ verticalAlign: "top" }} />
          </motion.span>
          <span className="tabular-nums">{shown}</span>
          <span style={{ opacity: 0.75 }}>/ {goal}</span>

          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.id}
                className="absolute"
                style={{ right: "1cqw", top: "100%", fontSize: "1.6cqw", color: COLORS.hover }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -10] }}
                transition={{ duration: 1.8, times: [0, 0.2, 0.75, 1] }}
                onAnimationComplete={() => setGain(null)}
              >
                +{gain.n}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
