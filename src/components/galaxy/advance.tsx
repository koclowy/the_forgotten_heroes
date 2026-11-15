"use client";
/**
 * "Click anywhere to continue".
 * The stage owns ONE click handler + ONE keyboard listener. The dialog box whose line is
 * currently active registers itself here (useAdvanceSlot); a click anywhere on the stage
 * drives that box only, so one click can never advance two things.
 *
 * Clicks on buttons, links, inputs or anything inside [data-no-advance] are ignored
 * (they do their own job), and so is everything while the info modal is open.
 */
import { useIsPresent } from "motion/react";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { sound } from "../../audio/sound";

/** Returns true if the click did something (finished typing or went to the next line). */
type Advance = () => boolean;
type Entry = { id: string; advance: Advance; waiting: boolean };
type Controller = {
  claim: (id: string, advance: Advance) => void;
  release: (id: string) => void;
  setWaiting: (id: string, waiting: boolean) => void;
};

export const AdvanceContext = createContext<Controller | null>(null);

const IGNORE_CLICK = "button, a, input, select, textarea, label, [data-no-advance]";
const IGNORE_KEY = "button, a, input, select, textarea";
/** info modal open → nothing advances. */
const blocked = () => !!document.querySelector("[data-modal-open]");
/** "click the i" hint showing → clicks only dismiss it (keys still work, so keyboard users can't get stuck). */
const hintOpen = () => !!document.querySelector("[data-hint-open]");

export function useAdvanceController() {
  const stack = useRef<Entry[]>([]);
  const [waiting, setWaitingState] = useState(false);

  const ctl = useMemo<Controller>(() => {
    const sync = () => setWaitingState(!!stack.current[stack.current.length - 1]?.waiting);
    return {
      claim(id, advance) {
        stack.current = [...stack.current.filter((e) => e.id !== id), { id, advance, waiting: false }];
        sync();
      },
      release(id) {
        stack.current = stack.current.filter((e) => e.id !== id);
        sync();
      },
      setWaiting(id, w) {
        const e = stack.current.find((x) => x.id === id);
        if (!e) return;
        e.waiting = w;
        sync();
      },
    };
  }, []);

  const fire = () => {
    const top = stack.current[stack.current.length - 1];
    if (!top) return false;
    const acted = top.advance();
    if (acted) sound.play("buttons.click");
    return acted;
  };

  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(IGNORE_CLICK) || blocked() || hintOpen()) return;
    fire();
  };

  // keyboard: Enter / Space / → drive the active dialog (not when focus is on a button)
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!["Enter", " ", "ArrowRight"].includes(e.key)) return;
      if ((e.target as HTMLElement).closest?.(IGNORE_KEY) || blocked()) return;
      if (!stack.current.length) return;
      e.preventDefault();
      fireRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { ctl, onClick, waiting };
}

/**
 * Register a dialog box as the one that stage clicks drive.
 * `waiting` = finished typing and waiting for a click (drives the "Click anywhere" hint).
 */
export function useAdvanceSlot(enabled: boolean, advance: Advance, waiting: boolean) {
  const ctl = useContext(AdvanceContext);
  const id = useId();
  // a box that is animating out (AnimatePresence exit) no longer takes clicks
  const present = useIsPresent();
  enabled = enabled && present;
  const ref = useRef(advance);
  ref.current = advance;
  useEffect(() => {
    if (!ctl || !enabled) return;
    ctl.claim(id, () => ref.current());
    return () => ctl.release(id);
  }, [ctl, enabled, id]);
  useEffect(() => {
    if (ctl && enabled) ctl.setWaiting(id, waiting);
  }, [ctl, enabled, id, waiting]);
}
