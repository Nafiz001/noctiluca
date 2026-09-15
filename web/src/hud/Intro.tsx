"use client";

import { useSea } from "@/lib/store";
import { count } from "./format";

// At the surface, before the dive. The name itself is drawn in plankton by
// the scene; this is everything around it.
export function Intro({ onBegin }: { onBegin: () => void }) {
  const stats = useSea((s) => s.stats);
  const glowing = useSea((s) => Object.keys(s.lights).length);
  const divers = useSea((s) => Object.keys(s.divers).length);
  const connected = useSea((s) => s.connected);

  return (
    <section className="intro">
      <h1 className="sr-only">noctiluca</h1>
      <p className="intro-lede">
        Strangers have left messages in this sea as lights, at the depths where they wrote them. Dive to read them, and
        leave one of your own.
      </p>
      <p className="intro-state">
        {stats || glowing ? `${count(glowing, "light is", "lights are")} glowing below.` : "Listening for the sea…"}{" "}
        {connected && (divers ? `${count(divers, "other diver is", "other divers are")} in the water.` : "No one else is diving right now.")}
      </p>
      <button className="action action-lantern action-large" onClick={onBegin}>
        Begin the dive
      </button>
      <p className="intro-hint pointer-only">Scroll or use the arrow keys to descend. Your pointer is your lamp.</p>
      <p className="intro-hint touch-only">Drag up to descend. Touch the water to point your lamp.</p>
    </section>
  );
}
