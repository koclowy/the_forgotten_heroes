/**
 * Layout + timing. (Text lives in public/content/*.json, artwork in public/assets/.)
 *
 * Every position is a PERCENTAGE of the 16:9 stage (measured from the Figma
 * frames at 840 x 472). `left` / `top` are the CENTRE of the element,
 * `w` / `h` are width / height as % of stage width / height.
 */
import type { Transition } from "motion/react";
import type { PlanetId } from "../../content/load";
export type { PlanetId };

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** Figma "Smart animate · Quick · 1000ms" equivalent. */
export const QUICK: Transition = { type: "spring", duration: 1, bounce: 0.18 };
// Prefer no overshoot? swap for: { duration: 1, ease: [0.16, 1, 0.3, 1] }

/** Planets drifting in on the title screen. */
export const FLOAT_IN: Transition = { duration: 2.2, ease: [0.22, 1, 0.36, 1] };
export const FADE: Transition = { duration: 0.7, ease: "easeInOut" };

export const TIMING = {
  typingStartDelay: 1.4, // s — start typing once planets have mostly floated in
  typingLetterStagger: 0.08, // s per letter
  afterTypingDelay: 1600, // ms — pause on the finished title before the scientist intro
  navigationLock: 950, // ms — ignore clicks while a transition is running
  tooltipDelay: 2800, // ms — screen 4 "click the i" hint
  dialogCharsPerSecond: 45, // speed of every dialog / description typing out
};

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

export const COLORS = {
  gold: "#F5B027", // frames, pills, points
  hover: "#FFE53B", // dashed hover rings / rocket path
  bubbleBorder: "#2D4BFF",
  correct: "#2FBF71",
  wrong: "#E5484D",
};

/* ------------------------------------------------------------------ */
/* Starfield (assets/image/stars/{x}/ — one big drifting star layer)   */
/* ------------------------------------------------------------------ */

export const STARFIELD = {
  /** seconds for the stars to drift one screen-width (bigger = slower) */
  secondsPerScreen: 75,
  /** direction tilt in degrees: 0 = straight right → left, positive = also drifting slightly up */
  tiltDeg: 6,
  opacity: 1,
  /** biggest resolution folder ever loaded (stars are soft, x2/x3 cost a lot of GPU memory) */
  maxScale: "x2" as "x1" | "x2" | "x3",
  /** with "reduce motion" switched on in the OS: stop the drift */
  stopForReducedMotion: true,
};

/* ------------------------------------------------------------------ */
/* Top pill ("Hover over the planets to explore!")                     */
/* ------------------------------------------------------------------ */

/** sizes in cqw (% of stage width), `top` = centre in % of stage height */
export const PILL = { top: 8.6, fontSize: 1.45, padY: 0.6, border: 0.28, lineHeight: 1.5 };
/** bottom edge of the pill, % of stage height */
export const PILL_BOTTOM = PILL.top + ((PILL.fontSize * PILL.lineHeight + 2 * PILL.padY + 2 * PILL.border) / 2) * (16 / 9);

/* ------------------------------------------------------------------ */
/* Planets                                                             */
/* ------------------------------------------------------------------ */

export const PLANET_IDS: PlanetId[] = ["earth", "moon", "mars"];
export type Box = { left: number; top: number; w: number };

/** Screen 1 — title composition. */
export const TITLE_LAYOUT: Record<PlanetId, Box> = {
  earth: { left: 50, top: 120, w: 58 },
  moon: { left: 30.4, top: 40, w: 11.4 },
  mars: { left: 68.5, top: 21, w: 21.4 },
};

/** Where each planet starts before floating in (off-screen). */
export const ENTRY_LAYOUT: Record<PlanetId, Box> = {
  earth: { left: 50, top: 175, w: 58 },
  moon: { left: -12, top: 30, w: 11.4 },
  mars: { left: 112, top: -25, w: 21.4 },
};

/** Screen 2 — planets in a row. */
export const ROW_LAYOUT: Record<PlanetId, Box> = {
  earth: { left: 21, top: 48.3, w: 25.8 },
  moon: { left: 49.8, top: 42.4, w: 11.4 },
  mars: { left: 76.3, top: 49.6, w: 21.8 },
};

/** Screen 3 — the chosen planet becomes the horizon at the bottom. */
export const SURFACE_LAYOUT: Box = { left: 50, top: 151, w: 115 };
/** Screen 4 — the planet sinks out of frame (zooming into equipment). */
export const SURFACE_EXIT_LAYOUT: Box = { left: 50, top: 260, w: 170 };

/** Screen 3/4 — the planets you didn't pick fly off the top and grow. */
export const offTop = (id: PlanetId): Box => {
  const r = ROW_LAYOUT[id];
  return { left: 50 + (r.left - 50) * 1.6, top: -45, w: r.w * 1.7 };
};

/* ------------------------------------------------------------------ */
/* Rocket                                                              */
/* ------------------------------------------------------------------ */

export type RocketPose = Box & { rotate: number };

/**
 * The rocket artwork (rocket/{x}/Rocket.png + Rocketboost.png, same canvas): x1 = 200 x 584.
 * `noseX` / `noseY` = the nose tip as a fraction of the canvas. Update if the art changes.
 */
export const ROCKET_ART = { aspect: 584 / 200, noseX: 99.5 / 200, noseY: 4 / 584 };

/** Nose tip of the rocket at `pose` (+ `extraRotate` degrees), in % of the stage. */
export function rocketNose(pose: RocketPose, extraRotate = 0) {
  const d = (0.5 - ROCKET_ART.noseY) * ROCKET_ART.aspect * pose.w; // centre → nose, in cqw
  const dx = (ROCKET_ART.noseX - 0.5) * pose.w;
  const a = ((pose.rotate + extraRotate) * Math.PI) / 180;
  // CSS rotate is clockwise; the nose points "up" (-y) before rotating
  const x = dx * Math.cos(a) + d * Math.sin(a);
  const y = dx * Math.sin(a) - d * Math.cos(a);
  return { left: pose.left + x, top: pose.top + (y * 16) / 9 };
}

export const ROCKET = {
  // widths keep the old ratios to `row` (entry 8.5/9, title 8/9, hidden 13/9)
  entry: { left: 75, top: 130, w: 4.9, rotate: 22 } as RocketPose,
  title: { left: 61.7, top: 68.5, w: 4.6, rotate: 22 } as RocketPose,
  /** tail tucked into Earth's rim, 36° right of its top; nose ends ~2.4 % below the pill */
  row: { left: 29.9, top: 25.8, w: 5.2, rotate: 32 } as RocketPose,
  hidden: { left: 34, top: -40, w: 7.5, rotate: 32 } as RocketPose,
  /** Nose position on screen 2 (start of the dashed flight path), derived from `row`. */
  rowNose: { left: 0, top: 0 },
};
ROCKET.rowNose = rocketNose(ROCKET.row);

/* ------------------------------------------------------------------ */
/* Scientist                                                           */
/* ------------------------------------------------------------------ */

/** `left` = centre x, `bottom` = where the feet are (% from stage top), `h` = height % of stage. */
export type SciPose = { left: number; bottom: number; h: number };

/** Nova's size in every layout (1 = the original Figma size). Her feet stay where they are. */
export const NOVA_SCALE = 1.1;
const nova = (left: number, bottom: number, h: number): SciPose => ({ left, bottom, h: h * NOVA_SCALE });

export const SCIENTIST = {
  /** intro / ending — big, centre-left */
  stage: nova(30, 99, 80),
  stageOff: nova(-15, 99, 80),
  /** pops in from bottom-left during equipment chats / bonus announcement */
  corner: nova(12.5, 104, 60),
  cornerOff: nova(-14, 104, 60),
  /** equipment chat: the corner pose, CHAT_NOVA_SCALE bigger, feet in the same place (set below) */
  chat: undefined as unknown as SciPose,
};

/** How much bigger Nova is while chatting with the equipment (vs. the corner size). */
export const CHAT_NOVA_SCALE = 1.2;
SCIENTIST.chat = { ...SCIENTIST.corner, h: SCIENTIST.corner.h * CHAT_NOVA_SCALE };

/**
 * Where Nova's highest point is in her artwork, as a fraction of the image height
 * (the raised hand of the wave / point bodies: y 66 of 3117 px). Update if her art changes.
 */
export const NOVA_TOP_IN_ART = 66 / 3117;

/** Round back button on screens 3/4: centre `left` / `top` in %, `size` in cqw. */
export const BACK_BUTTON = { left: 4.2, top: 7.5, size: 2.8 };

/** CSS `bottom` (% from the stage bottom) that puts a bubble's tail just above Nova's head at `pose`. */
function bubbleBottomAbove(pose: SciPose) {
  const headTop = pose.bottom - pose.h + pose.h * NOVA_TOP_IN_ART; // % from the top
  const tail = 1.2 * (16 / 9); // the bottom-left tail hangs 1.2cqw below the box
  const gap = 1.5;
  return 100 - (headTop - tail - gap);
}

/** Dialog bubble anchors next to Nova (% of the stage). */
export const NOVA_BUBBLE = {
  /** intro / ending: right of her (she spans ~19–38.5 % incl. the raised hand at this size) */
  stage: { left: 42, top: 20 },
  /** corner (bonus announcement): the bubble's tail ends just above her head */
  corner: {
    left: 4,
    /** cqw; keeps the bubble left of the "i" button in equipment chat mode (it sits at ~36 % from the left) */
    maxWidth: 28,
    bottom: bubbleBottomAbove(SCIENTIST.corner),
  },
  /**
   * equipment chat: same, above the bigger chat-size Nova. That puts the bubble up level with the
   * back button, so it starts right of it and is narrower so it still ends left of the "i" button.
   */
  chat: {
    left: BACK_BUTTON.left + BACK_BUTTON.size / 2 + 1.4,
    /** cqw; right edge (+ 0.6cqw border) ends ~1.7 % left of the "i" button in CHAT_FRAME */
    maxWidth: 27,
    bottom: bubbleBottomAbove(SCIENTIST.chat),
  },
};

/* ------------------------------------------------------------------ */
/* Equipment                                                           */
/* ------------------------------------------------------------------ */

export type FramePose = { left: number; top: number; w: number; h: number; rotate: number };

/** Screen 3 slots for 3 items (from your prototype). Other counts are spread along the horizon. */
const PROTOTYPE_SLOTS: FramePose[] = [
  { left: 18.1, top: 42.6, w: 15.5, h: 27.5, rotate: -27 },
  { left: 49.9, top: 31.1, w: 15.5, h: 27.5, rotate: 0 },
  { left: 81.9, top: 45.5, w: 15.5, h: 27.5, rotate: 37 },
];
export function slotsFor(n: number): FramePose[] {
  if (n === 3) return PROTOTYPE_SLOTS;
  // place along an arc just above the planet surface (1600x900 stage units)
  const cx = 800, cy = 1359, R = 920 + 150;
  const max = Math.min(50, 17 * (n - 1));
  const w = n > 4 ? (15.5 * 4) / n : 15.5;
  return Array.from({ length: n }, (_, i) => {
    const deg = n === 1 ? 0 : -max + (2 * max * i) / (n - 1);
    const rad = (deg * Math.PI) / 180;
    return {
      left: (cx + R * Math.sin(rad)) / 16,
      top: (cy - R * Math.cos(rad)) / 9,
      w,
      h: (w * 16) / 9,
      rotate: deg * 0.8,
    };
  });
}

/** Screen 4 frame poses: reading descriptions / chatting with the scientist / taking the quiz. */
export const FOCUS_FRAME: FramePose = { left: 45.8, top: 39.2, w: 45.8, h: 53.8, rotate: -0.6 };
export const CHAT_FRAME: FramePose = { left: 58, top: 40, w: 34, h: 44, rotate: 1.2 };
export const QUIZ_FRAME: FramePose = { left: 38, top: 27, w: 26, h: 33, rotate: -1 };
export type DetailMode = "focus" | "chat" | "quiz";
export const DETAIL_FRAMES: Record<DetailMode, FramePose> = {
  focus: FOCUS_FRAME,
  chat: CHAT_FRAME,
  quiz: QUIZ_FRAME,
};

/**
 * How much bigger the equipment drawing is inside the frame when it's zoomed in (DETAIL_FRAMES),
 * compared with the planet surface. The frame itself doesn't change.
 * 1.2 → a square drawing with ~6 % transparent margin fills ~85–90 % of the frame's height.
 * Per equipment, "imageScale" in its JSON multiplies this (e.g. 1.15 for a drawing with extra empty space).
 */
export const EQUIPMENT_ART_SCALE_ZOOMED = 1.2;

/** Bonus equipment floating in open space on screen 2. */
export const BONUS_SLOT: FramePose = { left: 50, top: 80, w: 9, h: 16, rotate: -12 };

/** Screen 4 — the equipment you didn't pick fly out sideways. */
export const flyOut = (slot: FramePose, dir: -1 | 1): FramePose => ({
  left: slot.left + dir * 78,
  top: slot.top + 8,
  w: slot.w * 1.8,
  h: slot.h * 1.8,
  rotate: slot.rotate + dir * 18,
});

/** Equipment rising from / sinking into the surface (screen 2 ↔ 3). */
export const sunk = (slot: FramePose): FramePose => ({
  ...slot,
  top: 82,
  w: slot.w * 0.35,
  h: slot.h * 0.35,
});
