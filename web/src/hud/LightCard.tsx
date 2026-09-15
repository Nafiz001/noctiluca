"use client";

import { useRef, useState } from "react";
import { Vector3 } from "three";

import { SeaError, api } from "@/lib/api";
import { now } from "@/lib/motion";
import { formatDepth } from "@/lib/ocean";
import { wavelengthCss } from "@/lib/spectrum";
import { type LiveLight, useSea } from "@/lib/store";
import { lightPosition } from "@/scene/placement";
import { shared, stage } from "@/scene/shared";
import { ago, count, fadesIn } from "./format";
import { useTicker } from "./useTicker";

// Reading a light, and answering it.
export function LightCard() {
  const light = useSea((s) => (s.selectedId ? s.lights[s.selectedId] : null));
  // A fresh card, with fresh busy and error state, for every light.
  return light ? <Card key={light.id} light={light} /> : null;
}

function Card({ light }: { light: LiveLight }) {
  const select = useSea((s) => s.select);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const scratch = useRef(new Vector3());

  // Sit on whichever side of the screen the light isn't, so the light you're
  // reading stays in view.
  useTicker(() => {
    if (!card.current || !stage.camera) return;
    const v = lightPosition(light, now(), shared.uSpread.value, scratch.current).project(stage.camera);
    const left = card.current.classList.contains("light-card-left");
    if (!left && v.x > 0.1) card.current.classList.add("light-card-left");
    else if (left && v.x < -0.1) card.current.classList.remove("light-card-left");
  });

  const answer = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.answer(light.id);
      useSea.getState().updateLight({ ...updated }, true);
    } catch (e) {
      if (e instanceof SeaError && e.status === 404) {
        useSea.getState().removeLight(light.id);
        useSea.getState().say("That light has gone dark.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't reach the sea. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const colour = wavelengthCss(light.wavelength);

  return (
    <aside ref={card} className="light-card" aria-label="A light" style={{ ["--light" as string]: colour }}>
      <button className="close" onClick={() => select(null)} aria-label="Close">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
      <span className="light-card-orb" aria-hidden="true" />
      <blockquote className="light-card-message">{light.message}</blockquote>
      <dl className="light-card-facts">
        <div>
          <dt>Left at</dt>
          <dd>{formatDepth(light.depth)}</dd>
        </div>
        <div>
          <dt>Released</dt>
          <dd>{ago(light.created_at)}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd>{light.wavelength} nm</dd>
        </div>
      </dl>
      <p className="light-card-life">
        {light.answers > 0 ? `Answered ${count(light.answers, "time", "times")}. ` : "No one has answered it yet. "}
        {fadesIn(light.dark_at)}.
      </p>
      {light.yours ? (
        <p className="light-card-note">This is your light. Others can answer it to keep it glowing.</p>
      ) : light.answered ? (
        <p className="light-card-note">You answered this light. It burns a little longer because of you.</p>
      ) : (
        <button className="action action-lantern" onClick={answer} disabled={busy}>
          {busy ? "Answering" : "Answer with light"}
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
