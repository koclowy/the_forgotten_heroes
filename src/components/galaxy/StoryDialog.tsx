"use client";
/** Nova + dialog box, stepping through lines from story.json (intro, bonus, ending). */
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { sound } from "../../audio/sound";
import { fill, type StoryLine } from "../../content/load";
import { NOVA_BUBBLE, SCIENTIST } from "./config";
import { DialogBubble } from "./DialogBubble";
import { Scientist, type ScientistArt } from "./Scientist";

export function StoryDialog({
  lines,
  layout,
  art,
  name,
  vars,
  onLine,
  onDone,
}: {
  lines: StoryLine[];
  layout: "stage" | "corner";
  art: ScientistArt;
  name: string;
  vars: Record<string, string | number>;
  onLine?: (line: StoryLine, index: number) => void;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [typing, setTyping] = useState(false);
  const line = lines[Math.min(i, lines.length - 1)];

  useEffect(() => onLine?.(line, i), [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => (i < lines.length - 1 ? setI(i + 1) : onDone());
  const stage = layout === "stage";

  return (
    <>
      <Scientist
        art={art}
        look={line}
        at={stage ? SCIENTIST.stage : SCIENTIST.corner}
        from={stage ? SCIENTIST.stageOff : SCIENTIST.cornerOff}
        talking={typing}
      />
      <motion.div
        className="absolute z-[11]"
        style={
          stage
            ? { left: `${NOVA_BUBBLE.stage.left}%`, top: `${NOVA_BUBBLE.stage.top}%`, originX: 0, originY: 0.3 }
            : { left: `${NOVA_BUBBLE.corner.left}%`, bottom: `${NOVA_BUBBLE.corner.bottom}%`, originX: 0.1, originY: 1 }
        }
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.55 }}
      >
        <DialogBubble
          text={fill(line.text, { ...vars, name })}
          resetKey={i}
          name={name}
          delay={i === 0 ? 0.7 : 0}
          maxWidth={stage ? "40cqw" : `${NOVA_BUBBLE.corner.maxWidth}cqw`}
          tail={stage ? "left" : "bottom-left"}
          onAdvance={next}
          button={line.button}
          onButton={next}
          voice={sound.voiceFor("scientist")}
          onTyping={setTyping}
          style={{ position: "relative" }}
        />
      </motion.div>
    </>
  );
}
