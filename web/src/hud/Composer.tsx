"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { motion } from "@/lib/motion";
import { formatDepth } from "@/lib/ocean";
import { WAVELENGTH_MAX, WAVELENGTH_MIN, wavelengthCss, wavelengthNote } from "@/lib/spectrum";
import { useSea } from "@/lib/store";

const MAX = 180;

const spectrumGradient = (() => {
  const stops: string[] = [];
  for (let nm = WAVELENGTH_MIN; nm <= WAVELENGTH_MAX; nm += 15) {
    stops.push(`${wavelengthCss(nm)} ${(((nm - WAVELENGTH_MIN) / (WAVELENGTH_MAX - WAVELENGTH_MIN)) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
})();

// Leaving a light at the depth you're at.
export function Composer() {
  const open = useSea((s) => s.composerOpen);
  return open ? <ComposerForm /> : null;
}

function ComposerForm() {
  const openComposer = useSea((s) => s.openComposer);
  const [message, setMessage] = useState("");
  const [wavelength, setWavelength] = useState(474);
  const [depth] = useState(() => Math.round(motion.depth));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const left = MAX - message.length;
  const release = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Write something for the light to carry.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const light = await api.release({ message, wavelength, depth });
      useSea.getState().addLight(light);
      openComposer(false);
      setMessage("");
      useSea.getState().say("Your light is in the water. It will glow for about two weeks, longer if someone answers it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the sea. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="composer"
      onSubmit={release}
      aria-label="Leave a light"
      style={{ ["--light" as string]: wavelengthCss(wavelength) }}
      onKeyDown={(e) => {
        if (e.key === "Escape") openComposer(false);
        e.stopPropagation();
      }}
    >
      <div className="composer-head">
        <h2>Leave a light</h2>
        <p>It will hang here, at {formatDepth(depth)}, for anyone who dives this deep.</p>
      </div>
      <label className="composer-field">
        <span className="sr-only">What your light says</span>
        <textarea
          ref={field}
          value={message}
          maxLength={MAX}
          rows={3}
          placeholder="Something you'd tell the dark"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <span className={`composer-count${left < 20 ? " low" : ""}`}>{left} left</span>
      </label>
      <div className="composer-colour">
        <div className="composer-colour-row">
          <span className="composer-orb" aria-hidden="true" />
          <label htmlFor="wavelength">Colour</label>
          <output htmlFor="wavelength">{wavelength} nm</output>
        </div>
        <input
          id="wavelength"
          type="range"
          min={WAVELENGTH_MIN}
          max={WAVELENGTH_MAX}
          value={wavelength}
          onChange={(e) => setWavelength(Number(e.target.value))}
          style={{ ["--spectrum" as string]: spectrumGradient }}
        />
        <p className="composer-note">{wavelengthNote(wavelength)}</p>
      </div>
      <p className="composer-rules">No links, emails, phone numbers or handles. Lights are anonymous.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="composer-actions">
        <button type="button" className="action action-quiet" onClick={() => openComposer(false)}>
          Cancel
        </button>
        <button type="submit" className="action action-lantern" disabled={busy}>
          {busy ? "Releasing" : "Release light"}
        </button>
      </div>
    </form>
  );
}
