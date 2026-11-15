"use client";
/**
 * Screen 4. Steps through the equipment's `script` from its JSON file:
 *   narrator  → description panel at the bottom (click anywhere for the next one)
 *   scientist → Nova slides in; the frame moves aside so they can chat
 *   equipment → the equipment's speech bubble
 * After the last line the multiple-choice quiz appears.
 * The frame itself is drawn by GalaxyExperience; this tells it which pose (`onMode`).
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { sound } from "../../audio/sound";
import type { Equipment } from "../../content/load";
import { COLORS, DETAIL_FRAMES, NOVA_BUBBLE, QUICK, SCIENTIST, TIMING, type DetailMode } from "./config";
import { DialogBubble } from "./DialogBubble";
import { PointsIcon } from "./PointsIcon";
import { Quiz, QUIZ_START, type QuizProgress } from "./Quiz";
import { ScaledImg } from "./ScaledImg";
import { Scientist, type ScientistArt } from "./Scientist";

/**
 * Dim layers live inside the 16:9 stage (so their stacking with the "i" button / tooltip / card
 * stays the same) but reach far past it, so the letterbox bars get dimmed (and clickable) too.
 * The stage doesn't clip; the full-screen container around it does. (Not position:fixed: the
 * stage is transformed, so fixed would still be sized to the stage.)
 */
const DIM_BLEED = "-200vmax";

export function EquipmentScene({
  item,
  completed,
  isBonus,
  backLabel,
  art,
  scientistName,
  hintSeen,
  onHintSeen,
  onMode,
  onPass,
  onBack,
  onFinish,
}: {
  item: Equipment;
  completed: boolean;
  isBonus: boolean;
  backLabel: string;
  art: ScientistArt;
  scientistName: string;
  hintSeen: boolean;
  onHintSeen: () => void;
  onMode: (m: DetailMode) => void;
  onPass: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const script = item.script;
  const [step, setStep] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [open, setOpen] = useState(false);
  const [sciTyping, setSciTyping] = useState(false);
  // quiz progress for this visit (this scene remounts per equipment): "Read again" resumes here
  const [quizProgress, setQuizProgress] = useState<QuizProgress>(QUIZ_START);

  /* ---------- where are we in the script? ---------- */
  const inQuiz = step >= script.length;
  const line = inQuiz ? null : script[step];

  // a "run" = consecutive non-narrator lines; Nova is on stage for any run she speaks in
  const run = useMemo(() => {
    if (!line || line.speaker === "narrator") return null;
    let a = step;
    while (a > 0 && script[a - 1].speaker !== "narrator") a--;
    let b = step;
    while (b < script.length - 1 && script[b + 1].speaker !== "narrator") b++;
    return { start: a, end: b, hasScientist: script.slice(a, b + 1).some((l) => l.speaker === "scientist") };
  }, [line, step, script]);

  const mode: DetailMode = inQuiz ? "quiz" : run?.hasScientist ? "chat" : "focus";
  useEffect(() => onMode(mode), [mode, onMode]);

  const lastIdx = (speaker: string, from = 0) => {
    for (let i = Math.min(step, script.length - 1); i >= from; i--) if (script[i].speaker === speaker) return i;
    return -1;
  };
  const eqIdx = lastIdx("equipment");
  const narIdx = lastIdx("narrator");
  const sciIdx = run?.hasScientist ? lastIdx("scientist", run.start) : -1;

  const next = () => setStep((s) => Math.min(s + 1, script.length));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  /* ---------- hint + modal ---------- */
  useEffect(() => {
    if (hintSeen) return;
    const t = setTimeout(() => setShowHint(true), TIMING.tooltipDelay);
    return () => clearTimeout(t);
  }, [hintSeen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const openInfo = () => {
    setShowHint(false);
    onHintSeen();
    setOpen(true);
  };

  /* ---------- positions follow the frame ---------- */
  const f = DETAIL_FRAMES[mode];
  const frameRight = f.left + f.w / 2;
  const frameLeft = f.left - f.w / 2;
  const frameTop = f.top - f.h / 2;
  const bubbleLeft = frameRight + 2.2;
  const bubbleMax = `${Math.max(16, Math.min(27, 100 - bubbleLeft - 2.5))}cqw`;

  return (
    <>
      {/* equipment speech bubble */}
      <motion.div
        className="absolute z-[6]"
        style={{ originX: 0, originY: 0 }}
        initial={{ opacity: 0, scale: 0.4, left: `${bubbleLeft}%`, top: `${frameTop - 1.3}%` }}
        animate={{ opacity: 1, scale: 1, left: `${bubbleLeft}%`, top: `${frameTop - 1.3}%` }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
        transition={{ ...QUICK, opacity: { duration: 0.3, delay: 0.75 }, scale: { type: "spring", stiffness: 380, damping: 22, delay: 0.75 } }}
      >
        <DialogBubble
          text={eqIdx >= 0 ? script[eqIdx].text : item.greeting}
          resetKey={`eq-${eqIdx}`}
          name={item.name}
          delay={eqIdx < 0 ? 1.05 : 0}
          active={line?.speaker === "equipment"}
          onAdvance={next}
          maxWidth={bubbleMax}
          tail="left"
          voice={item.voice}
          chorusVoice={eqIdx >= 0 ? script[eqIdx].chorusVoiceUrls : undefined}
          style={{ position: "relative" }}
        />
      </motion.div>

      {/* description panel (narrator lines) */}
      <AnimatePresence>
        {mode === "focus" && narIdx >= 0 && (
          <motion.div
            key="panel"
            className="absolute z-[6]"
            style={{ left: "8.8%", width: "83%", top: "73%" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, transition: { duration: 0.25 } }}
            transition={{ type: "spring", duration: 0.8, bounce: 0.15, delay: 0.5 }}
          >
            <DialogBubble
              variant="panel"
              width="100%"
              text={script[narIdx].text}
              resetKey={`n-${narIdx}`}
              delay={step === 0 ? 0.9 : 0}
              active={line?.speaker === "narrator"}
              onAdvance={next}
              voice={sound.voiceFor("narrator")}
              footer={() => (
                <div
                  className="flex items-center justify-between"
                  style={{ marginTop: "0.6cqw", fontSize: "0.95cqw", color: "#4a4f6e" }}
                >
                  <span className="flex items-center" style={{ gap: "0.8cqw" }}>
                    <button
                      type="button"
                      disabled={step === 0}
                      onClick={(e) => (e.stopPropagation(), prev())}
                      className="disabled:opacity-30"
                      aria-label="Previous"
                    >
                      ◂ Back
                    </button>
                    <span>
                      {step + 1} / {script.length}
                    </span>
                  </span>
                  <span className="flex items-center" style={{ gap: "1.2cqw" }}>
                    {completed && (
                      <button type="button" onClick={(e) => (e.stopPropagation(), setStep(script.length))} className="underline">
                        Skip to quiz
                      </button>
                    )}
                  </span>
                </div>
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* the scientist joins the conversation */}
      <AnimatePresence>
        {mode === "chat" && (
          <Scientist
            key="sci"
            art={art}
            look={sciIdx >= 0 ? script[sciIdx] : undefined}
            at={SCIENTIST.chat}
            from={SCIENTIST.cornerOff}
            talking={line?.speaker === "scientist" && sciTyping}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mode === "chat" && sciIdx >= 0 && (
          <motion.div
            key={`sci-bubble-${run?.start}`}
            className="absolute z-[11]"
            style={{ left: `${NOVA_BUBBLE.chat.left}%`, bottom: `${NOVA_BUBBLE.chat.bottom}%`, originX: 0.1, originY: 1 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.15 }}
          >
            <DialogBubble
              text={script[sciIdx].text}
              resetKey={`s-${sciIdx}`}
              name={scientistName}
              active={line?.speaker === "scientist"}
              onAdvance={next}
              maxWidth={`${NOVA_BUBBLE.chat.maxWidth}cqw`}
              tail="bottom-left"
              voice={sound.voiceFor("scientist")}
              onTyping={setSciTyping}
              style={{ position: "relative" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* quiz */}
      <AnimatePresence>
        {inQuiz && (
          <Quiz
            key="quiz"
            quiz={item.quiz}
            alreadyDone={completed}
            isBonus={isBonus}
            backLabel={backLabel}
            progress={quizProgress}
            onProgress={setQuizProgress}
            onPass={onPass}
            onBack={onBack}
            onFinish={onFinish}
            onReview={() => setStep(0)}
          />
        )}
      </AnimatePresence>

      {/* dim layer behind the hint (click anywhere to dismiss) */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            key="hint-dim"
            className="absolute z-[12] bg-black/45"
            style={{ inset: DIM_BLEED }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-no-advance
            data-hint-open
            onClick={() => (setShowHint(false), onHintSeen())}
          />
        )}
      </AnimatePresence>

      {/* "i" button, pinned to the frame's top-left */}
      <motion.button
        type="button"
        aria-label={`More information about ${item.name}`}
        onClick={openInfo}
        className="absolute z-[13] grid place-items-center rounded-full bg-white text-[#1a1d33] outline-none"
        style={{
          width: "2.9cqw",
          height: "2.9cqw",
          x: "-50%",
          y: "-50%",
          fontSize: "1.5cqw",
        }}
        initial={{ opacity: 0, scale: 0, left: `${frameLeft - 3.2}%`, top: `${frameTop + 2.4}%` }}
        animate={{ opacity: 1, scale: 1, left: `${frameLeft - 3.2}%`, top: `${frameTop + 2.4}%` }}
        exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.92 }}
        transition={{ ...QUICK, opacity: { delay: 0.95 }, scale: { type: "spring", stiffness: 400, damping: 18, delay: 0.95 } }}
      >
        i
        {showHint && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${COLORS.hover}` }}
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.button>

      {/* hint tooltip */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            key="hint"
            className="pointer-events-none absolute z-[13] flex flex-col items-center"
            style={{ left: `${frameLeft - 3.2}%`, top: `${frameTop + 5.3}%`, x: "-50%" }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <motion.span
              className="block rounded-full"
              style={{ width: "0.5cqw", height: "0.5cqw", background: COLORS.hover }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            />
            <motion.span
              className="block"
              style={{ width: 1.5, height: "5.2cqw", background: COLORS.hover, originY: 0 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
            />
            <motion.span
              className="block whitespace-nowrap rounded-[0.9cqw] bg-[#FFFBF2] text-[#111]"
              style={{
                border: `max(2px,0.3cqw) solid ${COLORS.hover}`,
                padding: "0.75cqw 1.8cqw",
                fontSize: "1.15cqw",
                marginTop: "-0.2cqw",
              }}
              initial={{ opacity: 0, scale: 0.6, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.38 }}
            >
              Click me to view more information!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* info modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="modal-dim"
              data-no-advance
              className="absolute z-[40] bg-black/45"
              style={{ inset: DIM_BLEED }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="modal"
              role="dialog"
              aria-modal="true"
              aria-label={item.name}
              data-modal-open
              className="absolute z-[41] flex flex-col overflow-hidden bg-white text-[#1a1d33]"
              style={{
                left: "50%",
                top: "50%",
                width: "41%",
                height: "79%",
                x: "-50%",
                borderRadius: "2.4cqw",
                padding: "2.2cqw 2.2cqw 2cqw",
              }}
              initial={{ opacity: 0, scale: 0.85, y: "-42%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: "-46%", transition: { duration: 0.2 } }}
              transition={{ type: "spring", duration: 0.55, bounce: 0.22 }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                autoFocus
                data-no-advance
                className="absolute z-[1] grid place-items-center rounded-full border border-[#1a1d33] transition-colors hover:bg-[#1a1d33] hover:text-white"
                style={{ right: "2cqw", top: "1.4cqw", width: "2.3cqw", height: "2.3cqw", fontSize: "1.3cqw" }}
              >
                ✕
              </button>
              <PhotoGallery
                photos={item.moreInfo.images.length ? item.moreInfo.images : item.image ? [item.image] : []}
                isPhoto={item.moreInfo.images.length > 0}
                name={item.name}
              />
              {item.moreInfo.imageCredit && (
                <p className="shrink-0 text-right" style={{ fontSize: "0.8cqw", opacity: 0.6, marginTop: "0.4cqw" }}>
                  {item.moreInfo.imageCredit}
                </p>
              )}
              <motion.div
                data-no-advance
                tabIndex={0}
                aria-label={`About ${item.name}`}
                className="info-scroll min-h-0 flex-1 overflow-y-auto outline-none"
                style={{ marginTop: "1.6cqw", fontSize: "1.15cqw", lineHeight: 1.5, paddingRight: "0.8cqw" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <h3 style={{ fontSize: "1.6cqw", letterSpacing: "0.02em", marginBottom: "0.6cqw" }}>
                  {item.name}
                </h3>
                <p>{item.moreInfo.text}</p>
                {item.moreInfo.funFacts.length > 0 && (
                  <section style={{ marginTop: "1.6cqw" }}>
                    <h4
                      className="flex items-center"
                      style={{ fontSize: "1.35cqw", letterSpacing: "0.02em", color: COLORS.bubbleBorder, gap: "0.5cqw", marginBottom: "0.6cqw" }}
                    >
                      <PointsIcon label="" size="1.2em" style={{ verticalAlign: "middle" }} />
                      Fun facts
                    </h4>
                    <ul className="list-disc" style={{ paddingLeft: "1.4cqw", lineHeight: 1.6 }}>
                      {item.moreInfo.funFacts.map((fact, k) => (
                        <li key={k} style={{ marginTop: k ? "0.55cqw" : 0, paddingLeft: "0.2cqw" }}>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {item.moreInfo.sources.length > 0 && (
                  <footer style={{ marginTop: "1.8cqw", fontSize: "0.85cqw", lineHeight: 1.5, color: "#6b7090" }}>
                    <span className="uppercase" style={{ letterSpacing: "0.08em" }}>{item.moreInfo.sources.length > 1 ? "Sources: " : "Source: "}</span>
                    {item.moreInfo.sources.map((s, k) => (
                      <span key={s.url + k}>
                        {k > 0 && " · "}
                        <a
                          href={s.url}
                          title={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-no-advance
                          className="underline decoration-1 underline-offset-2 hover:text-[#1a1d33]"
                        >
                          {s.label}
                        </a>
                      </span>
                    ))}
                  </footer>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * The "i" card's picture area: one photo, or a small gallery (arrows + dots + swipe, no autoplay)
 * when there are <id>-1, <id>-2, … files. Clicks here never advance a dialog (data-no-advance).
 */
function PhotoGallery({ photos, isPhoto, name }: { photos: Equipment["moreInfo"]["images"]; isPhoto: boolean; name: string }) {
  const [i, setI] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const n = photos.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const arrow = (d: -1 | 1) => (
    <button
      type="button"
      aria-label={d < 0 ? "Previous photo" : "Next photo"}
      data-no-advance
      onClick={() => go(d)}
      className="absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#1a1d33] transition-colors hover:bg-white"
      style={{ [d < 0 ? "left" : "right"]: "0.8cqw", width: "2.2cqw", height: "2.2cqw", fontSize: "1.1cqw" }}
    >
      {d < 0 ? "‹" : "›"}
    </button>
  );
  return (
    <div
      data-no-advance
      // 16:9 like the photos (real_equipment x1 800×450), the card's full inner width
      className="relative grid w-full shrink-0 place-items-center overflow-hidden"
      style={{ marginTop: "2.6cqw", aspectRatio: "16 / 9", fontSize: "1.1cqw", background: "#1b2142", borderRadius: "1cqw" }}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null || n < 2) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 30) go(dx < 0 ? 1 : -1);
        setTouchX(null);
      }}
      onKeyDown={(e) => {
        if (n < 2) return;
        if (e.key === "ArrowLeft") (e.stopPropagation(), go(-1));
        if (e.key === "ArrowRight") (e.stopPropagation(), go(1));
      }}
    >
      {n ? (
        <ScaledImg
          key={i}
          src={photos[i]}
          fit={isPhoto ? "cover" : "contain"}
          alt={n > 1 ? `${name}, photo ${i + 1} of ${n}` : name}
          // photos fill the area edge to edge; the drawn art (no photo) sits whole on the dark background
          className={`h-full w-full ${isPhoto ? "object-cover" : "object-contain"}`}
          style={{ padding: isPhoto ? 0 : "1.2cqw" }}
        />
      ) : (
        <span className="text-white/60">image of the equipment</span>
      )}
      {n > 1 && (
        <>
          {arrow(-1)}
          {arrow(1)}
          <div className="absolute left-1/2 flex -translate-x-1/2" style={{ bottom: "0.7cqw", gap: "0.45cqw" }}>
            {photos.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Photo ${k + 1}`}
                aria-current={k === i}
                data-no-advance
                onClick={() => setI(k)}
                className="rounded-full transition-colors"
                style={{ width: "0.6cqw", height: "0.6cqw", background: k === i ? "#fff" : "rgba(255,255,255,.4)" }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
