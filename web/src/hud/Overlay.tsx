"use client";

import { useRef, useState } from "react";

import { diveTo, motion } from "@/lib/motion";
import { CHALLENGER_DEEP, WORLD_DEPTH, formatDepth, progressAt } from "@/lib/ocean";
import { sound } from "@/lib/sound";
import { useSea } from "@/lib/store";
import { creatures } from "@/scene/creatures/common";
import { count } from "./format";
import { useTicker } from "./useTicker";

// Smaller pieces of the HUD.

export function SoundToggle() {
  const [on, setOn] = useState(sound.enabled);
  useTicker(() => sound.update(motion.depth, Math.abs(motion.velocity) * WORLD_DEPTH));
  return (
    <button
      className="sound-toggle"
      aria-pressed={on}
      onClick={() => {
        sound.setEnabled(!on);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 20 14" aria-hidden="true">
        {[2, 6, 10, 14, 18].map((x, i) => (
          <line key={x} x1={x} x2={x} y1={7 - (on ? [2, 5, 3, 6, 2][i] : 0.6)} y2={7 + (on ? [2, 5, 3, 6, 2][i] : 0.6)} />
        ))}
      </svg>
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}

export function Presence() {
  const connected = useSea((s) => s.connected);
  const divers = useSea((s) => Object.keys(s.divers).length);
  const glowing = useSea((s) => Object.keys(s.lights).length);
  return (
    <div className="presence" aria-live="polite">
      <p>{count(glowing, "light glowing", "lights glowing")}</p>
      <p className={connected ? undefined : "presence-offline"}>
        {connected
          ? divers === 0
            ? "No one else is diving"
            : `${count(divers, "other diver", "other divers")} in the water`
          : "Offline, so lights won't update live"}
      </p>
    </div>
  );
}

export function HoverTip() {
  const light = useSea((s) => (s.hoveredId && s.hoveredId !== s.selectedId ? s.lights[s.hoveredId] : null));
  const ref = useRef<HTMLDivElement>(null);
  useTicker(() => {
    if (!ref.current) return;
    const x = ((motion.pointer.x + 1) / 2) * window.innerWidth;
    const y = ((1 - motion.pointer.y) / 2) * window.innerHeight;
    ref.current.style.transform = `translate3d(${x + 40}px, ${y - 14}px, 0)`;
  });
  if (!light) return null;
  const text = light.message.length > 70 ? `${light.message.slice(0, 68).trimEnd()}…` : light.message;
  return (
    <div ref={ref} className="hover-tip" aria-hidden="true">
      <p>{text}</p>
      <span>{formatDepth(light.depth)}</span>
    </div>
  );
}

export function CreatureCaption() {
  const slug = useSea((s) => s.foundCreature);
  const creature = useSea((s) => s.creatures.find((c) => c.slug === slug));
  const hidden = useSea((s) => Boolean(s.selectedId || s.composerOpen));
  if (!creature || hidden) return null;
  const state = creatures[creature.slug];
  const range =
    creature.depth_max >= CHALLENGER_DEEP
      ? `Lives below ${formatDepth(creature.depth_min)}`
      : `Lives at ${formatDepth(creature.depth_min).replace(" m", "")} to ${formatDepth(creature.depth_max)}`;
  return (
    <aside className="caption" key={creature.slug} aria-live="polite">
      <h3>{creature.name}</h3>
      <p className="caption-latin">{creature.latin_name}</p>
      <p className="caption-note">{creature.note}</p>
      <p className="caption-range">{range}</p>
      {state?.hasDisplay && <p className="caption-hint">Click it to see what it does when disturbed.</p>}
      {state && !state.glows && <p className="caption-hint">It makes no light. You found it with your lamp.</p>}
    </aside>
  );
}

export function Actions() {
  const openComposer = useSea((s) => s.openComposer);
  const composerOpen = useSea((s) => s.composerOpen);

  const nextLight = () => {
    const sea = useSea.getState();
    const here = motion.depth;
    const below = Object.values(sea.lights)
      .filter((l) => l.depth > here + 8)
      .sort((a, b) => a.depth - b.depth)[0];
    if (!below) {
      sea.say("There are no more lights below you. Maybe leave the first one.");
      return;
    }
    diveTo(progressAt(below.depth));
    sea.select(below.id);
  };

  // Hidden rather than unmounted while composing, so coming back doesn't
  // replay the entrance.
  return (
    <div className="actions" data-hidden={composerOpen} inert={composerOpen}>
      <button className="action action-quiet" onClick={nextLight}>
        <span className="wide-only">Find the next light down</span>
        <span className="narrow-only">Next light down</span>
      </button>
      <button className="action action-lantern" onClick={() => openComposer(true)}>
        Leave a light
      </button>
    </div>
  );
}

// Each notice plays its own fade in and out; a new one replaces it.
export function Notice() {
  const notice = useSea((s) => s.notice);
  if (!notice) return null;
  return (
    <p className="notice" role="status" key={notice.at}>
      {notice.text}
    </p>
  );
}

export function SeafloorCard() {
  const [atBottom, setAtBottom] = useState(false);
  const glowing = useSea((s) => Object.keys(s.lights).length);
  const hidden = useSea((s) => Boolean(s.selectedId || s.composerOpen));
  useTicker(() => {
    const bottom = motion.depth > CHALLENGER_DEEP - 60;
    if (bottom !== atBottom) setAtBottom(bottom);
  });
  if (!atBottom || hidden) return null;
  return (
    <section className="seafloor" aria-label="The bottom">
      <h2>Challenger Deep</h2>
      <p>
        {formatDepth(CHALLENGER_DEEP)}, the deepest known point in the ocean. Fewer people have been here than have been to space.{" "}
        {count(glowing, "light is", "lights are")} glowing above you.
      </p>
      <button className="action action-quiet" onClick={() => diveTo(0)}>
        Return to the surface
      </button>
    </section>
  );
}
