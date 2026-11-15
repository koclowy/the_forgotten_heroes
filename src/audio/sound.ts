/**
 * Sound effects, voices, and the entry point for music.
 * - Effects + voices use Web Audio (no lag, can overlap, pitch-varied voice blips).
 * - Music lives in ./music.ts (one controller, one element per track, gain-node crossfades);
 *   setMusic() / setMuted() here just forward to it.
 * Browsers block audio until the first click/tap/key. The site opens straight on the title
 * screen, so anything before that first gesture (e.g. the title typing) is silently skipped;
 * GalaxyExperience calls unlock() on the first pointerdown / click / key, and the music for the
 * current screen starts then. Missing files are silently skipped.
 */
import type { Content } from "../content/load";
import { TIMING } from "../components/galaxy/config";
import { music } from "./music";

type Channel = "effects" | "voices";

/**
 * Voice clips longer than this are "babble" loops (e.g. the equipment voices, ~6 s): instead of a
 * blip every few letters, each WORD plays a word-length slice of the clip from a random spot,
 * and a new word cuts off that speaker's previous one. Shorter clips (Nova's blips) keep the
 * classic blip-every-Nth-letter behaviour.
 */
const LONG_VOICE = 0.3;

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private decoded = new Map<string, AudioBuffer>();
  private bank: Record<string, string[]> = {};
  private extraVoices: string[] = [];
  private volume = { music: 0.3, effects: 0.8, voices: 0.55 };
  /** kept so a dev hot update can re-init the new manager (see the bottom of this file) */
  content: Content | null = null;
  private lastPlayed = new Map<string, number>();
  /** the babble slice currently playing per speaker */
  private speaking = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
  voiceEvery = 2;
  muted = false;
  private listeners = new Set<() => void>();

  /** Safe to call more than once (StrictMode runs effects twice; same content = no-op for music). */
  init(c: Content) {
    this.content = c;
    this.bank = c.sounds;
    this.volume = c.soundSettings.volume;
    this.voiceEvery = c.soundSettings.voiceEvery;
    this.extraVoices = Object.values(c.equipment).flatMap((e) => e.voice);
    try {
      this.muted = localStorage.getItem("fh-muted") === "1";
    } catch {
      /* storage unavailable */
    }
    music.configure(c.soundSettings.music, this.volume.music);
    music.setMuted(this.muted);
  }

  /** Call from a click/key handler. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        [...Object.values(this.bank).flat(), ...this.extraVoices].forEach((u) => this.load(u)); // warm the cache
      }
    }
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    // routes the tracks through Web Audio (first time) and starts the current screen's track
    music.attach(this.ctx);
  }

  /** Back on the tab: wake the audio context and the current track (browsers may pause them). */
  resume() {
    if (this.ctx && this.ctx.state !== "running" && this.ctx.state !== "closed") this.ctx.resume().catch(() => {});
    music.ensurePlaying();
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === "running";
  }

  private load(url: string) {
    if (!this.buffers.has(url) && this.ctx) {
      this.buffers.set(
        url,
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
          .then((b) => this.ctx!.decodeAudioData(b))
          .then((buf) => (this.decoded.set(url, buf), buf))
          .catch(() => null),
      );
    }
    return this.buffers.get(url) ?? Promise.resolve(null);
  }

  private async playUrl(url: string, channel: Channel, rate = 1, gain = 1) {
    if (this.muted || !this.ctx) return;
    const buf = await this.load(url);
    if (!buf || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = this.volume[channel] * gain;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  /** Play a sound by key from assets.json, e.g. "buttons.click", "game.correct". */
  play(key: string, opts: { gain?: number; minGap?: number } = {}) {
    const urls = this.bank[key];
    if (!urls?.length) return;
    // avoid machine-gun repeats (e.g. hover)
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < (opts.minGap ?? 40)) return;
    this.lastPlayed.set(key, now);
    this.playUrl(urls[Math.floor(Math.random() * urls.length)], "effects", 1, opts.gain ?? 1);
  }

  /**
   * Voice for one typed character (`text` = the whole line). Short blips: one every Nth letter,
   * slightly random pitch. Long "babble" clips: one word-length slice per word (see LONG_VOICE).
   */
  voice(
    urls: string[] | undefined,
    char: string,
    index: number,
    text = "",
    /** gain / pitch multipliers (e.g. a <chorus> line); newWord = treat this letter as a word start */
    opts: { gain?: number; pitch?: number; newWord?: boolean } = {},
  ) {
    const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
    if (!urls?.length || !isLetter(char) || this.muted || !this.ctx) return;
    const url = urls[Math.floor(Math.random() * urls.length)];
    const buf = this.decoded.get(url);
    if (!buf) return void this.load(url); // not decoded yet: stay quiet for now
    const rate = (0.92 + Math.random() * 0.16) * (opts.pitch ?? 1);
    const gainMul = opts.gain ?? 1;
    if (buf.duration <= LONG_VOICE) {
      if (index % this.voiceEvery === 0) this.playUrl(url, "voices", rate, gainMul);
      return;
    }
    if (isLetter(text[index - 1]) && !opts.newWord) return; // only at the start of a word
    let n = 1;
    while (isLetter(text[index + n])) n++;
    const dur = Math.min(Math.max(n / TIMING.dialogCharsPerSecond, 0.09), 0.5); // seconds
    const span = dur * rate; // in buffer time
    const offset = Math.random() * Math.max(0, buf.duration - span);
    const speaker = urls.join("|");
    this.stopVoice(urls);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const v = this.volume.voices * gainMul;
    // tiny fades so slicing into the middle of the clip doesn't click
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.setValueAtTime(v, t + Math.max(0.011, dur - 0.03));
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g).connect(ctx.destination);
    src.start(t, offset, span);
    src.onended = () => this.speaking.get(speaker)?.src === src && this.speaking.delete(speaker);
    this.speaking.set(speaker, { src, g });
  }

  /** Cut off a speaker's babble slice (e.g. when its line is finished early). */
  stopVoice(urls: string[] | undefined) {
    if (!urls?.length || !this.ctx) return;
    const key = urls.join("|");
    const s = this.speaking.get(key);
    if (!s) return;
    const t = this.ctx.currentTime;
    s.g.gain.cancelScheduledValues(t);
    s.g.gain.setValueAtTime(s.g.gain.value, t);
    s.g.gain.linearRampToValueAtTime(0, t + 0.015);
    try {
      s.src.stop(t + 0.02);
    } catch {
      /* already stopped */
    }
    this.speaking.delete(key);
  }

  voiceFor(speaker: "scientist" | "equipment" | "narrator") {
    return this.bank[`voices.${speaker}`];
  }

  /* ---------------- music (see ./music.ts) ---------------- */

  /**
   * The background track for the current screen ("normal" / "moon" / "mars" / "quiz", the keys of
   * assets.json → sounds.music; unknown names fall back to "normal"). Crossfades; the previous
   * track pauses where it is. Same track as now → nothing happens.
   */
  setMusic(name: string) {
    music.setMusic(name);
  }

  /** Start downloading every track (call in idle time once the game is running). */
  warmMusic() {
    music.preloadAll();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem("fh-muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
    music.setMuted(m);
    if (m) for (const key of [...this.speaking.keys()]) this.stopVoice(key.split("|"));
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
}

export const sound = new SoundManager();

// Dev hot update of this file: the new module gets a fresh `sound`, but the app may still hold the
// old one. Music lives in the music.ts singleton either way; pass the content on so the new
// manager isn't empty, and stop the music if this module is thrown away.
if (import.meta.hot) {
  const prev = import.meta.hot.data.sound as SoundManager | undefined;
  if (prev?.content) {
    sound.init(prev.content);
    music.ensurePlaying(); // the old module's dispose paused it; same single controller resumes
  }
  import.meta.hot.dispose((data) => {
    data.sound = sound;
    music.stopAll();
  });
}
