"use client";
/**
 * Multiple-choice quiz (A/B/C/D…). All questions right = points (awarded once, at the end).
 * A wrong answer = retry THAT question: the wrong option stays crossed out, earlier questions
 * are kept. The progress lives in EquipmentScene, so "Read again" resumes at the same question.
 */
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { answerIndex, letter, type Equipment } from "../../content/load";
import { sound } from "../../audio/sound";
import { COLORS } from "./config";
import { PointsIcon } from "./PointsIcon";

type Phase = "question" | "passed";

/** Where the player is in the quiz: question index + the options already tried wrong on it. */
export type QuizProgress = { qi: number; wrong: number[] };
export const QUIZ_START: QuizProgress = { qi: 0, wrong: [] };

export function Quiz({
  quiz,
  alreadyDone,
  isBonus,
  backLabel,
  progress,
  onProgress,
  onPass,
  onBack,
  onFinish,
  onReview,
}: {
  quiz: Equipment["quiz"];
  alreadyDone: boolean;
  isBonus: boolean;
  backLabel: string;
  /** kept by the parent for the current visit (survives "Read again") */
  progress: QuizProgress;
  onProgress: (p: QuizProgress) => void;
  /** called once when every question is answered correctly */
  onPass: () => void;
  onBack: () => void;
  onFinish: () => void;
  onReview: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(alreadyDone ? "passed" : "question");
  const [picked, setPicked] = useState<number | null>(null);
  const [earned, setEarned] = useState(false);

  const qi = Math.min(progress.qi, quiz.questions.length - 1);
  const q = quiz.questions[qi];
  const correctIdx = answerIndex(q);
  const isRight = picked !== null && picked === correctIdx;
  const isLast = qi === quiz.questions.length - 1;

  const pick = (i: number) => {
    setPicked(i);
    if (i === correctIdx) sound.play("game.correct");
    else {
      sound.play("game.wrong");
      // remembered right away, so it's still crossed out after "Read again"
      onProgress({ qi, wrong: [...progress.wrong, i] });
    }
  };
  /** wrong answer → same question again (the wrong option stays crossed out) */
  const tryAgain = () => setPicked(null);
  /** "Replay quiz" after passing → from question 1 */
  const replay = () => {
    onProgress(QUIZ_START);
    setPicked(null);
    setPhase("question");
  };
  const next = () => {
    if (!isLast) {
      onProgress({ qi: qi + 1, wrong: [] });
      setPicked(null);
      return;
    }
    if (!alreadyDone) setEarned(true);
    onPass();
    setPhase("passed");
  };

  const btn = (primary: boolean) =>
    ({
      padding: "0.55cqw 1.6cqw",
      fontSize: "1.1cqw",
      borderRadius: 999,
      letterSpacing: "0.04em",
      background: primary ? COLORS.gold : "transparent",
      color: primary ? "#1a1d33" : COLORS.gold,
      border: `2px solid ${COLORS.gold}`,
    }) as const;

  return (
    <motion.div
      className="absolute z-[8] text-white"
      style={{
        left: "50%",
        top: "48.5%",
        width: "82%",
        x: "-50%",
        padding: "1.3cqw 2cqw 1.4cqw",
        borderRadius: "1.2cqw",
        background: "rgba(14,18,44,.9)",
        border: `max(2px,0.25cqw) solid ${COLORS.gold}`,
        boxShadow: "0 1cqw 3cqw rgba(0,0,0,.35)",
      }}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60, transition: { duration: 0.25 } }}
      transition={{ type: "spring", duration: 0.8, bounce: 0.18, delay: 0.45 }}
    >
      <AnimatePresence mode="wait">
        {phase === "question" ? (
          <motion.div
            key={`q-${qi}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between" style={{ fontSize: "0.95cqw", color: COLORS.gold, letterSpacing: "0.08em" }}>
              <span className="uppercase" style={{ letterSpacing: "0.14em" }}>
                Quiz · Question {qi + 1} of {quiz.questions.length}
              </span>
              <span className="flex items-center" style={{ gap: "0.4em" }}>
                {isBonus || quiz.points === 0 ? (
                  "Bonus round"
                ) : (
                  <>
                    <PointsIcon label="" /> {quiz.points} Research Points
                  </>
                )}
              </span>
            </div>
            <p style={{ fontSize: "1.45cqw", lineHeight: 1.35, margin: "0.6cqw 0 1cqw" }}>{q.question}</p>

            <div className="grid grid-cols-2" style={{ gap: "0.8cqw" }}>
              {q.options.map((opt, i) => {
                const chosen = picked === i;
                const showRight = picked !== null && isRight && i === correctIdx;
                const showWrong = chosen && !isRight;
                // tried wrong earlier on this question: crossed out + can't be picked again
                const crossed = !chosen && progress.wrong.includes(i);
                const open = picked === null && !crossed;
                const bg = showRight ? COLORS.correct : showWrong ? COLORS.wrong : "#FFFBF2";
                const dim = crossed || (picked !== null && !chosen && !showRight);
                return (
                  <motion.button
                    key={i}
                    type="button"
                    disabled={!open}
                    aria-label={crossed ? `${letter(i)}: ${opt} (already tried, not correct)` : undefined}
                    data-sound="none"
                    onClick={() => pick(i)}
                    className="flex items-center text-left"
                    style={{
                      gap: "0.8cqw",
                      padding: "0.65cqw 1cqw",
                      borderRadius: "0.8cqw",
                      fontSize: "1.2cqw",
                      background: bg,
                      color: showRight || showWrong ? "#fff" : "#1a1d33",
                      textDecoration: crossed ? "line-through" : undefined,
                      textDecorationThickness: crossed ? "0.12em" : undefined,
                    }}
                    animate={{ opacity: dim ? 0.45 : 1, x: showWrong ? [0, -8, 8, -5, 5, 0] : 0 }}
                    whileHover={open ? { scale: 1.02, y: -2 } : {}}
                    whileTap={open ? { scale: 0.98 } : {}}
                    transition={{ duration: 0.35 }}
                  >
                    <span
                      className="grid shrink-0 place-items-center rounded-full"
                      style={{
                        width: "2cqw",
                        height: "2cqw",
                        fontSize: "1cqw",
                        background: showRight || showWrong ? "rgba(255,255,255,.25)" : COLORS.bubbleBorder,
                        color: "#fff",
                      }}
                    >
                      {letter(i)}
                    </span>
                    {opt}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {picked !== null && (
                <motion.div
                  key="fb"
                  className="flex flex-wrap items-center justify-between"
                  style={{ gap: "1cqw", marginTop: "1cqw", fontSize: "1.15cqw" }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <span style={{ color: isRight ? "#8EF0B8" : "#FFB3B5", maxWidth: "70%" }}>
                    {isRight ? `Correct! ${q.explanation ?? ""}` : "Not quite! Have another look and try this question again."}
                  </span>
                  <span className="flex" style={{ gap: "0.7cqw" }}>
                    {isRight ? (
                      <motion.button
                        type="button"
                        style={btn(true)}
                        whileHover={{ scale: 1.05 }}
                        onClick={next}
                        autoFocus
                        // "Collect Research Points" plays game.points instead of a click (GalaxyExperience → earn)
                        data-sound={isLast && !alreadyDone && quiz.points > 0 ? "none" : undefined}
                      >
                        {isLast ? (
                          alreadyDone || quiz.points === 0 ? (
                            "Finish quiz"
                          ) : (
                            <span className="inline-flex items-center" style={{ gap: "0.4em" }}>
                              Collect Research Points <PointsIcon />
                            </span>
                          )
                        ) : (
                          "Next question →"
                        )}
                      </motion.button>
                    ) : (
                      <>
                        <motion.button type="button" style={btn(false)} whileHover={{ scale: 1.05 }} onClick={onReview}>
                          Read again
                        </motion.button>
                        <motion.button type="button" style={btn(true)} whileHover={{ scale: 1.05 }} onClick={tryAgain} autoFocus>
                          Try again
                        </motion.button>
                      </>
                    )}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="passed"
            className="flex flex-col items-center text-center"
            style={{ gap: "0.8cqw", padding: "0.6cqw 0" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              style={{ fontSize: "2.6cqw" }}
              initial={{ rotate: -30, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
            >
              <PointsIcon size="3.2cqw" style={{ display: "block" }} />
            </motion.div>
            <p style={{ fontSize: "1.85cqw", letterSpacing: "0.03em", color: COLORS.gold }}>
              {isBonus ? "Bonus complete!" : "Quiz complete!"}
            </p>
            <p style={{ fontSize: "1.2cqw", color: "#cfd3ea" }}>
              {earned && quiz.points > 0
                ? `You earned ${quiz.points} Research Points.`
                : isBonus || quiz.points === 0
                  ? "You've uncovered the last forgotten hero."
                  : "You've already earned the Research Points for this one."}
            </p>
            <div className="flex" style={{ gap: "0.8cqw", marginTop: "0.4cqw" }}>
              <motion.button type="button" style={btn(false)} whileHover={{ scale: 1.05 }} onClick={replay}>
                Replay quiz
              </motion.button>
              {isBonus ? (
                <motion.button type="button" style={btn(true)} whileHover={{ scale: 1.05 }} onClick={onFinish} autoFocus>
                  Finish the mission →
                </motion.button>
              ) : (
                <motion.button type="button" style={btn(true)} whileHover={{ scale: 1.05 }} onClick={onBack} autoFocus>
                  {backLabel}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
