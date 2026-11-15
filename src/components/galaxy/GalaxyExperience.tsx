"use client";
/**
 * The Forgotten Heroes: A Discovery — scene controller + game state.
 *
 *  title ─▶ intro (scientist) ─▶ planets ─▶ planet ─▶ equipment (script + quiz)
 *                                   │  ◀── back ──    ◀── back ──
 *                                   └─ (all quizzes done) bonus ─▶ equipment ─▶ ending ─▶ credits ─▶ title
 *
 * One persistent set of planets / rocket / frames is animated between per-scene
 * layouts (config.ts), so transitions behave like Figma smart animate and play in
 * reverse on back. All text comes from public/content/*.json.
 */
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sound } from "../../audio/sound";
import type { Content, PlanetId, StoryLine } from "../../content/load";
import { TypewriterEffect } from "../ui/typewriter-effect";
import {
  BACK_BUTTON,
  BONUS_SLOT,
  COLORS,
  DETAIL_FRAMES,
  ENTRY_LAYOUT,
  FADE,
  FLOAT_IN,
  PILL,
  PILL_BOTTOM,
  PLANET_IDS,
  QUICK,
  ROCKET,
  ROW_LAYOUT,
  SURFACE_EXIT_LAYOUT,
  SURFACE_LAYOUT,
  TIMING,
  TITLE_LAYOUT,
  flyOut,
  offTop,
  rocketNose,
  slotsFor,
  sunk,
  type Box,
  type DetailMode,
} from "./config";
import { AdvanceContext, useAdvanceController } from "./advance";
import { useCursor } from "./cursor";
import { PointsIcon, PointsIconContext } from "./PointsIcon";
import { prewarmScaled, useScaledSrc } from "./ScaledImg";
import { Starfield } from "./Starfield";
import { EquipmentFrame } from "./EquipmentFrame";
import { EquipmentScene } from "./EquipmentScene";
import { Planet, type PlanetLook } from "./Planet";
import { PointsHud } from "./PointsHud";
import { Rocket } from "./Rocket";
import { StoryDialog } from "./StoryDialog";

type Scene = "title" | "intro" | "planets" | "planet" | "equipment" | "ending" | "credits";

export default function GalaxyExperience({ content }: { content: Content }) {
  const { theme, art, planets, equipment, story, bonusId, goal } = content;
  const sciArt = art.nova;
  const sciName = theme.scientistName;

  /* ---------------- navigation state ---------------- */
  const [scene, setScene] = useState<Scene>("title");
  const advance = useAdvanceController();
  const [planet, setPlanet] = useState<PlanetId>("moon");
  const [eqId, setEqId] = useState<string>("");
  const [detailMode, setDetailMode] = useState<DetailMode>("focus");
  const [hoverPlanet, setHoverPlanet] = useState<PlanetId | null>(null);
  const [hoverEq, setHoverEq] = useState<string | null>(null);
  const [titleRun, setTitleRun] = useState(0);

  /* ---------------- game state ---------------- */
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [hudVisible, setHudVisible] = useState(false);
  const [hudHighlight, setHudHighlight] = useState(false);
  const [bonusChat, setBonusChat] = useState(false);
  const [bonusAnnounced, setBonusAnnounced] = useState(false);
  const [hintSeen, setHintSeen] = useState(false);

  const planetEquipmentIds = useMemo(() => PLANET_IDS.flatMap((id) => planets[id].equipment), [planets]);
  const allDone = planetEquipmentIds.every((id) => completed.includes(id));
  const bonusOut = !!bonusId && allDone && (bonusChat || bonusAnnounced);
  const isBonus = scene === "equipment" && eqId === bonusId;
  const vars = { name: sciName, goal, points };

  /* ---------------- navigation helpers ---------------- */
  const busy = useRef(false);
  const go = useCallback((fn: () => void) => {
    if (busy.current) return;
    busy.current = true;
    fn();
    setHoverPlanet(null);
    setHoverEq(null);
    setTimeout(() => (busy.current = false), TIMING.navigationLock);
  }, []);

  const toIntro = () => go(() => setScene((s) => (s === "title" ? "intro" : s)));
  const toPlanets = () =>
    go(() => {
      setHudVisible(true);
      setHudHighlight(false);
      setScene("planets");
    });
  const openPlanet = (id: PlanetId) => go(() => (setPlanet(id), setScene("planet")));
  const openEquipment = (id: string) => go(() => (setEqId(id), setDetailMode("focus"), setScene("equipment")));
  const back = useCallback(
    () =>
      go(() =>
        setScene((s) => {
          if (s === "equipment") return eqId === bonusId ? "planets" : "planet";
          if (s === "planet") return "planets";
          return s;
        }),
      ),
    [go, eqId, bonusId],
  );
  const restart = () =>
    go(() => {
      setPoints(0);
      setCompleted([]);
      setHudVisible(false);
      setBonusAnnounced(false);
      setBonusChat(false);
      setTitleRun((n) => n + 1);
      setScene("title");
    });

  /* ---------------- sound wiring ---------------- */
  // Browsers block audio until the first gesture: unlock on the first pointerdown / click / key
  // anywhere (sounds before that, like the title typing, are silently skipped).
  // Any button → click sound (override with data-sound="key" or "none"). Dialog advances play
  // their own click sound in advance.tsx.
  useEffect(() => {
    const onClick = (e: Event) => {
      sound.unlock();
      const el = (e.target as HTMLElement).closest<HTMLElement>("button, [role=button]");
      if (!el || (el as HTMLButtonElement).disabled) return;
      const key = el.dataset.sound ?? "buttons.click";
      if (key !== "none") sound.play(key);
    };
    const unlock = () => sound.unlock();
    // back on the tab: browsers (iOS especially) may have paused the context / the track
    const onVisible = () => document.visibilityState === "visible" && sound.resume();
    window.addEventListener("click", onClick, true);
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // custom cursor (CSS variables, rules in galaxy.css)
  useCursor(art.cursor);

  // after startup, quietly load the sharper files that zooms will need (again after a resize)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const run = () => prewarmScaled(content);
    const onResize = () => (clearTimeout(t), (t = setTimeout(run, 400)));
    t = setTimeout(run, 1200);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [content]);

  // scene change → transition sound
  const prevScene = useRef(scene);
  useEffect(() => {
    const from = prevScene.current;
    prevScene.current = scene;
    if (from === scene) return;
    const deeper = ["planets", "planet", "equipment"];
    const key =
      from === "title" && scene === "intro"
        ? "transitions.titleToIntro"
        : scene === "planets" && (from === "intro" || from === "title")
          ? "transitions.introToPlanets"
          : scene === "ending"
            ? "transitions.toEnding"
            : scene === "credits"
              ? "transitions.toCredits"
              : deeper.includes(from) && deeper.includes(scene)
                ? deeper.indexOf(scene) > deeper.indexOf(from)
                  ? "transitions.zoomIn"
                  : "transitions.zoomOut"
                : null;
    if (key) sound.play(key);
  }, [scene]);

  // background music for the current screen (assets.json → sounds.music; crossfades in sound.ts)
  //   planet surface + its equipment → that planet's track; any quiz → "quiz";
  //   bonus equipment's script, and everything else → "normal"
  useEffect(() => {
    const onEquipment = scene === "equipment";
    const track =
      onEquipment && detailMode === "quiz"
        ? "quiz"
        : (scene === "planet" || onEquipment) && !isBonus
          ? planet
          : "normal";
    sound.setMusic(track);
  }, [scene, detailMode, isBonus, planet]);

  // the first screen's track loads right away (sound.init); the others once the game is running
  useEffect(() => {
    const t = setTimeout(() => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => sound.warmMusic(), { timeout: 5000 });
      else sound.warmMusic();
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (bonusChat) setTimeout(() => sound.play("game.bonusAppears"), 500);
  }, [bonusChat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  // title → intro after the typewriter finishes
  const typingDone = () => setTimeout(() => setScene((s) => (s === "title" ? "intro" : s)), TIMING.afterTypingDelay);

  // all quizzes done → scientist announces the bonus the next time we're on the planets screen
  useEffect(() => {
    if (scene !== "planets" || !bonusId || !allDone || bonusAnnounced || bonusChat) return;
    const t = setTimeout(() => setBonusChat(true), 1100);
    return () => clearTimeout(t);
  }, [scene, allDone, bonusAnnounced, bonusChat, bonusId]);

  const earn = () => {
    const item = equipment[eqId];
    if (!item || completed.includes(eqId)) return;
    setCompleted((c) => [...c, eqId]);
    setPoints((p) => p + item.quiz.points);
    // the "Collect Research Points" button itself is silent (data-sound="none"), so this plays alone
    if (item.quiz.points > 0) sound.play("game.points");
  };

  const onIntroLine = (line: StoryLine) => {
    if (line.showPoints) setHudVisible(true);
    setHudHighlight(!!line.showPoints);
  };

  /* ---------------- per-scene layouts ---------------- */
  const planetBox = (id: PlanetId): Box => {
    switch (scene) {
      case "title":
      case "intro":
      case "ending":
      case "credits":
        return TITLE_LAYOUT[id];
      case "planets":
        return ROW_LAYOUT[id];
      default:
        if (isBonus || id !== planet) return offTop(id);
        return scene === "planet" ? SURFACE_LAYOUT : SURFACE_EXIT_LAYOUT;
    }
  };
  const planetLook = (id: PlanetId): PlanetLook =>
    ["title", "intro", "ending", "credits"].includes(scene)
      ? "title"
      : (scene === "planet" || scene === "equipment") && id === planet && !isBonus
        ? "surface"
        : "flat";
  const planetsHidden = scene === "intro" || scene === "ending";

  const rocketPose =
    scene === "title" || scene === "intro" || scene === "credits" || scene === "ending"
      ? ROCKET.title
      : scene === "planets"
        ? ROCKET.row
        : ROCKET.hidden;
  const rocketTilt = scene === "planets" && hoverPlanet === "moon" ? 8 : scene === "planets" && hoverPlanet === "mars" ? 18 : 0;

  const planetItems = planets[planet].equipment.map((id) => equipment[id]);
  const slots = slotsFor(planetItems.length);
  const focusIdx = planetItems.findIndex((e) => e.id === eqId);
  const framePose = (i: number) => {
    if (scene !== "equipment") return slots[i];
    if (i === focusIdx) return DETAIL_FRAMES[detailMode];
    return flyOut(slots[i], i < focusIdx ? -1 : 1);
  };

  const depth = { title: 1, intro: 1, planets: 1, planet: 1.08, equipment: 1.16, ending: 1.04, credits: 1 }[scene];
  // background picks x1/x2/x3 by its size (incl. the depth push-in)
  const bg = useScaledSrc<HTMLDivElement>(art.background, "cover", depth);

  return (
    <MotionConfig reducedMotion="user">
      <AdvanceContext.Provider value={advance.ctl}>
      <PointsIconContext.Provider value={art.researchPoints}>
      {/* one click handler for the whole screen: drives the active dialog (advance.tsx) */}
      <div
        className="relative h-[100dvh] w-full overflow-hidden bg-[#161a33] text-white"
        style={{ fontFamily: "var(--font-ui)" }}
        onClick={advance.onClick}
        data-advance-waiting={advance.waiting ? "" : undefined}
      >
        {/* backdrop — slight push-in for each level of zoom */}
        <motion.div
          ref={bg.ref}
          className="pointer-events-none absolute inset-[-10%]"
          animate={{ scale: depth }}
          transition={QUICK}
          style={{
            background: bg.src
              ? `center / cover no-repeat url("${bg.src}")`
              : "radial-gradient(ellipse 85% 22% at 50% 23%, rgba(67,52,120,.95) 0%, rgba(55,44,99,.55) 45%, rgba(0,0,0,0) 100%)," +
                "radial-gradient(ellipse 90% 25% at 50% 78%, rgba(24,16,36,.9) 0%, rgba(0,0,0,0) 100%)," +
                "linear-gradient(180deg, #221c3d 0%, #2b2552 18%, #1b2142 42%, #171c38 62%, #1a1530 100%)",
          }}
        >
          {/* drifting star layer, inside the backdrop so it gets the same push-in */}
          <Starfield src={art.stars} depth={depth} />
        </motion.div>
        {!art.background && <div className="grain pointer-events-none absolute inset-0 opacity-[.18] mix-blend-overlay" />}

        {/* 16:9 stage, letterboxed. `cqw` units scale text with the stage. */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "min(100vw, 177.78dvh)", height: "min(100dvh, 56.25vw)", containerType: "size" }}
        >

          {/* ---------------- planets ---------------- */}
          {PLANET_IDS.map((id) => {
            const p = planets[id];
            const explorable = p.equipment.length > 0;
            const done = p.equipment.filter((e) => completed.includes(e)).length;
            return (
              <Planet
                key={id}
                id={id}
                label={`Explore ${p.name}`}
                image={p.image}
                color={p.color}
                box={planetBox(id)}
                initial={ENTRY_LAYOUT[id]}
                transition={scene === "title" || scene === "credits" ? FLOAT_IN : QUICK}
                look={planetLook(id)}
                float={scene === "title" || scene === "credits"}
                hidden={planetsHidden}
                hovered={hoverPlanet === id}
                interactive={scene === "planets" && explorable}
                onHover={(on) => setHoverPlanet(on ? id : null)}
                onSelect={() => openPlanet(id)}
                caption={
                  scene === "planets" && explorable
                    ? `${p.name} · ${done}/${p.equipment.length}${done === p.equipment.length ? " ✓" : ""}`
                    : undefined
                }
              />
            );
          })}

          <Rocket
            src={art.rocket}
            boostSrc={art.rocketBoost}
            boost={scene === "planets" && !!hoverPlanet && planets[hoverPlanet].equipment.length > 0}
            pose={rocketPose}
            initial={ROCKET.entry}
            transition={scene === "title" ? { ...FLOAT_IN, delay: 0.3 } : QUICK}
            float={scene === "title" || scene === "planets" || scene === "credits"}
            hidden={scene === "intro" || scene === "ending"}
            tilt={rocketTilt}
          />

          <AnimatePresence>
            {scene === "planets" && hoverPlanet && planets[hoverPlanet].equipment.length > 0 && (
              // starts at the nose of the rocket as it tilts towards the hovered planet
              <FlightPath key={hoverPlanet} start={rocketNose(ROCKET.row, rocketTilt)} target={ROW_LAYOUT[hoverPlanet]} />
            )}
          </AnimatePresence>

          {/* ---------------- equipment on the chosen planet ---------------- */}
          <AnimatePresence>
            {(scene === "planet" || (scene === "equipment" && !isBonus)) &&
              planetItems.map((item, i) => (
                <EquipmentFrame
                  key={`${planet}-${item.id}`}
                  item={item}
                  index={i}
                  pose={framePose(i)}
                  from={sunk(slots[i])}
                  focused={scene === "equipment" && i === focusIdx}
                  interactive={scene === "planet"}
                  hovered={hoverEq === item.id && scene === "planet"}
                  onHover={(on) => setHoverEq(on ? item.id : null)}
                  onSelect={() => openEquipment(item.id)}
                  completed={completed.includes(item.id)}
                />
              ))}
          </AnimatePresence>

          {/* ---------------- bonus equipment (hidden until every quiz is done) ---------------- */}
          <AnimatePresence>
            {bonusId &&
              ((scene === "planets" && bonusOut) || isBonus) && (
                <EquipmentFrame
                  key="bonus"
                  item={equipment[bonusId]}
                  index={0}
                  pose={isBonus ? DETAIL_FRAMES[detailMode] : BONUS_SLOT}
                  from={{ ...BONUS_SLOT, rotate: 200, w: 0.5, h: 0.9 }}
                  exitTo={{ ...BONUS_SLOT, w: 2, h: 3.5 }}
                  delay={0.4}
                  focused={isBonus}
                  interactive={scene === "planets" && !bonusChat}
                  hovered={hoverEq === bonusId && scene === "planets"}
                  onHover={(on) => setHoverEq(on ? bonusId : null)}
                  onSelect={() => openEquipment(bonusId)}
                  completed={completed.includes(bonusId)}
                  glow={scene === "planets"}
                />
              )}
          </AnimatePresence>

          {/* ---------------- screen 4 ---------------- */}
          <AnimatePresence>
            {scene === "equipment" && equipment[eqId] && (
              <EquipmentScene
                key={eqId}
                item={equipment[eqId]}
                completed={completed.includes(eqId)}
                isBonus={isBonus}
                backLabel={`Back to ${planets[planet].name}`}
                art={sciArt}
                scientistName={sciName}
                hintSeen={hintSeen}
                onHintSeen={() => setHintSeen(true)}
                onMode={setDetailMode}
                onPass={earn}
                onBack={back}
                onFinish={() => go(() => setScene("ending"))}
              />
            )}
          </AnimatePresence>

          {/* ---------------- title ---------------- */}
          <AnimatePresence>
            {scene === "title" && (
              <motion.div
                key={`title-${titleRun}`}
                className="absolute inset-x-0 z-[6] flex justify-center"
                style={{ top: "50%", y: "-50%" }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                <TypewriterEffect
                  words={theme.title.split(" ").map((text) => ({ text }))}
                  delay={titleRun === 0 ? TIMING.typingStartDelay : 0.5}
                  stagger={TIMING.typingLetterStagger}
                  onComplete={typingDone}
                  onLetter={() => sound.play("game.titleTyping", { minGap: 0, gain: 0.7 })}
                  font="700 1em Neoteric"
                  className="title-font tracking-[0.02em] text-white"
                  cursorClassName="ml-[0.3cqw] h-[4.2cqw] w-[0.35cqw] bg-white"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---------------- scientist: intro / bonus / ending ---------------- */}
          <AnimatePresence>
            {scene === "intro" && (
              <StoryDialog
                key="intro"
                lines={story.intro}
                layout="stage"
                art={sciArt}
                name={sciName}
                vars={vars}
                onLine={onIntroLine}
                onDone={toPlanets}
              />
            )}
            {scene === "planets" && bonusChat && (
              <StoryDialog
                key="bonus-chat"
                lines={story.bonusUnlocked}
                layout="corner"
                art={sciArt}
                name={sciName}
                vars={vars}
                onDone={() => (setBonusChat(false), setBonusAnnounced(true))}
              />
            )}
            {scene === "ending" && (
              <StoryDialog
                key="ending"
                lines={story.ending}
                layout="stage"
                art={sciArt}
                name={sciName}
                vars={vars}
                onDone={() => go(() => setScene("credits"))}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>{scene === "credits" && <Credits key="credits" credits={story.credits} points={points} goal={goal} onRestart={restart} />}</AnimatePresence>

          {/* ---------------- chrome ---------------- */}
          <PointsHud points={points} goal={goal} visible={hudVisible && scene !== "credits" && scene !== "title"} highlight={hudHighlight} />

          <AnimatePresence mode="wait">
            {scene === "planets" && !bonusChat && (
              <Pill key="p1">{bonusOut && !completed.includes(bonusId!) ? "A bonus has appeared in space!" : "Hover over the planets to explore!"}</Pill>
            )}
            {scene === "planet" && <Pill key="p2">Hover over the equipment to view!</Pill>}
          </AnimatePresence>

          <AnimatePresence>
            {(scene === "planet" || scene === "equipment") && (
              <motion.button
                key="back"
                type="button"
                aria-label="Back"
                data-sound="buttons.back"
                onClick={back}
                className="absolute z-[35] grid place-items-center rounded-full border-[1.5px] border-white text-white outline-none"
                style={{
                  left: `${BACK_BUTTON.left}%`,
                  top: `${BACK_BUTTON.top}%`,
                  width: `${BACK_BUTTON.size}cqw`,
                  height: `${BACK_BUTTON.size}cqw`,
                  x: "-50%",
                  y: "-50%",
                }}
                initial={{ opacity: 0, x: "-120%" }}
                animate={{ opacity: 1, x: "-50%" }}
                exit={{ opacity: 0, x: "-120%" }}
                whileHover={{ scale: 1.12, backgroundColor: "rgba(255,255,255,.12)" }}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.35, delay: 0.3 }}
              >
                <svg viewBox="0 0 24 24" style={{ width: "55%" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 6 8.5 12l6 6" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>

          <ContinueHint visible={advance.waiting} />

          <MuteButton />

          {(scene === "title" || scene === "intro") && (
            <button
              type="button"
              onClick={scene === "title" ? toIntro : toPlanets}
              className="absolute z-[35] text-white/40 transition-colors hover:text-white"
              style={{ right: "2.5%", bottom: "4%", fontSize: "1cqw" }}
            >
              {scene === "title" ? "Skip intro →" : "Skip to the planets →"}
            </button>
          )}
        </div>
      </div>
      </PointsIconContext.Provider>
      </AdvanceContext.Provider>
    </MotionConfig>
  );
}

/** Subtle bottom-centre hint, shown while a dialog has finished typing and waits for a click. */
function ContinueHint({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="continue-hint"
          aria-hidden
          className="pointer-events-none absolute left-1/2 z-[34] whitespace-nowrap"
          style={{ bottom: "2.2%", x: "-50%", fontSize: "0.95cqw", letterSpacing: "0.06em", color: "#fff" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          Click anywhere to continue
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */

function Credits({
  credits,
  points,
  goal,
  onRestart,
}: {
  credits: Content["story"]["credits"];
  points: number;
  goal: number;
  onRestart: () => void;
}) {
  const item = (d: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const },
  });
  return (
    <motion.div
      className="absolute inset-0 z-[20] flex flex-col items-center justify-center text-center"
      style={{ gap: "1cqw", background: "radial-gradient(ellipse 50% 45% at 50% 50%, rgba(18,22,52,.85), rgba(18,22,52,0))" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <motion.h2 style={{ fontSize: "4cqw", lineHeight: 1.1, letterSpacing: "0.04em" }} {...item(0.4)}>
        {credits.heading}
      </motion.h2>
      <motion.p style={{ fontSize: "1.3cqw", color: COLORS.gold }} {...item(0.8)}>
        <PointsIcon /> {points} / {goal} Research Points collected
      </motion.p>
      {credits.subheading && (
        <motion.p className="uppercase" style={{ fontSize: "1cqw", letterSpacing: "0.2em", opacity: 0.7, marginTop: "1.2cqw" }} {...item(1.1)}>
          {credits.subheading}
        </motion.p>
      )}
      <div className="flex flex-wrap justify-center" style={{ gap: "0.6cqw 2.4cqw", maxWidth: "60cqw" }}>
        {credits.names.map((n, i) => (
          <motion.span key={n + i} style={{ fontSize: "1.6cqw" }} {...item(1.3 + i * 0.15)}>
            {n}
          </motion.span>
        ))}
      </div>
      {credits.note && (
        <motion.p style={{ fontSize: "0.95cqw", opacity: 0.55, marginTop: "1cqw" }} {...item(1.6 + credits.names.length * 0.15)}>
          {credits.note}
        </motion.p>
      )}
      <motion.button
        type="button"
        onClick={onRestart}
        className="rounded-full"
        style={{ marginTop: "1.6cqw", padding: "0.6cqw 2cqw", fontSize: "1.2cqw", letterSpacing: "0.04em", border: `2px solid ${COLORS.gold}`, color: COLORS.gold }}
        whileHover={{ scale: 1.06, backgroundColor: "rgba(245,176,39,.15)" }}
        {...item(2 + credits.names.length * 0.15)}
      >
        {credits.restart ?? "Play again"} ↻
      </motion.button>
    </motion.div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: "1.4em" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 6 6m0-6-6 6" />}
    </svg>
  );
}

/** Bottom-left mute toggle (remembered in this browser). */
function MuteButton() {
  const [muted, setMuted] = useState(sound.muted);
  useEffect(() => sound.subscribe(() => setMuted(sound.muted)), []);
  return (
    <motion.button
      type="button"
      data-sound="none"
      aria-label={muted ? "Turn sound on" : "Mute sound"}
      onClick={() => {
        sound.setMuted(!muted);
        if (muted) setTimeout(() => sound.play("buttons.click"), 30);
      }}
      className="absolute z-[35] grid place-items-center rounded-full text-white/60 transition-colors hover:text-white"
      style={{ left: "2.4%", bottom: "4%", width: "2.6cqw", height: "2.6cqw", fontSize: "1.2cqw", border: "1.5px solid currentColor" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileTap={{ scale: 0.9 }}
    >
      <SpeakerIcon on={!muted} />
    </motion.button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute left-1/2 z-[9] whitespace-nowrap rounded-full"
      style={{
        top: `${PILL.top}%`,
        x: "-50%",
        y: "-50%",
        border: `max(2px,${PILL.border}cqw) solid ${COLORS.gold}`,
        color: COLORS.gold,
        padding: `${PILL.padY}cqw 2cqw`,
        fontSize: `${PILL.fontSize}cqw`,
        lineHeight: PILL.lineHeight,
        background: "rgba(22,26,51,.35)",
      }}
      initial={{ opacity: 0, y: "-120%" }}
      animate={{ opacity: 1, y: "-50%", transition: { delay: 0.7, duration: 0.45, ease: "easeOut" } }}
      exit={{ opacity: 0, y: "-120%", transition: { duration: 0.2 } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Quadratic dashed arc from the rocket's nose to the top of the target's ring.
 * Its highest point is kept below the pill (PILL_BOTTOM + a small gap), so they never overlap.
 */
const FLIGHT_STROKE = 4;
function FlightPath({ start = ROCKET.rowNose, target }: { start?: { left: number; top: number }; target: Box }) {
  const sx = start.left * 16;
  const sy = start.top * 9;
  const r = (target.w / 100) * 1600 * 0.5 * 1.3;
  const ex = target.left * 16;
  const ey = target.top * 9 - r - 14;
  const cx = sx + (ex - sx) * 0.55;
  // highest allowed y (viewBox units, y grows downwards): just under the pill
  const limit = (PILL_BOTTOM + 1) * 9 + FLIGHT_STROKE / 2;
  // peak of a quadratic = (y0·y2 − cy²) / (y0 − 2cy + y2). Setting peak = limit gives the
  // highest control point allowed: cy = limit − √((y0 − limit)(y2 − limit)).
  const cyMin = limit < Math.min(sy, ey) ? limit - Math.sqrt((sy - limit) * (ey - limit)) : Math.min(sy, ey);
  const cy = Math.max(Math.min(sy, ey) - 150 - (ex - sx) * 0.08, cyMin);
  const d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  const ang = Math.atan2(ey - cy, ex - cx);
  const L = 26;
  const a1 = ang + Math.PI - 0.5;
  const a2 = ang + Math.PI + 0.5;
  const head = `M ${ex + L * Math.cos(a1)} ${ey + L * Math.sin(a1)} L ${ex} ${ey} L ${ex + L * Math.cos(a2)} ${ey + L * Math.sin(a2)}`;

  return (
    <motion.svg
      className="pointer-events-none absolute inset-0 z-[4] h-full w-full overflow-visible"
      viewBox="0 0 1600 900"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <mask id="flight-reveal">
        <motion.path d={d} fill="none" stroke="white" strokeWidth={12} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.55, ease: "easeOut" }} />
      </mask>
      <motion.path
        d={d}
        mask="url(#flight-reveal)"
        fill="none"
        stroke={COLORS.hover}
        strokeWidth={FLIGHT_STROKE}
        strokeLinecap="round"
        strokeDasharray="12 12"
        animate={{ strokeDashoffset: [0, -48] }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <motion.path
        d={head}
        fill="none"
        stroke={COLORS.hover}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45, duration: 0.2 }}
        style={{ originX: `${ex}px`, originY: `${ey}px` }}
      />
    </motion.svg>
  );
}
