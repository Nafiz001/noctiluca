"use client";

import { useRef } from "react";

import { diveTo, motion, nudge } from "@/lib/motion";
import { CHALLENGER_DEEP, ZONES, formatDepth, progressAt, zoneStart } from "@/lib/ocean";
import { wavelengthCss } from "@/lib/spectrum";
import { useSea } from "@/lib/store";
import { useTicker } from "./useTicker";

// The depth gauge down the left edge: the whole water column at once, with
// every glowing light and every other diver marked on it. Click or drag it
// to travel.
export function Gauge() {
  const lights = useSea((s) => s.lights);
  const divers = useSea((s) => s.divers);
  const track = useRef<HTMLDivElement>(null);
  const you = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);

  useTicker(() => {
    if (you.current) you.current.style.top = `${motion.progress * 100}%`;
    if (label.current) label.current.textContent = formatDepth(motion.depth);
    track.current?.setAttribute("aria-valuenow", String(Math.round(motion.depth)));
    track.current?.setAttribute("aria-valuetext", formatDepth(motion.depth));
  });

  const travel = (clientY: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    diveTo((clientY - rect.top) / rect.height);
  };

  return (
    <div className="gauge">
      <div
        ref={track}
        className="gauge-track"
        role="slider"
        tabIndex={0}
        aria-label="Depth"
        aria-valuemin={0}
        aria-valuemax={CHALLENGER_DEEP}
        aria-valuenow={0}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          travel(e.clientY);
        }}
        onPointerMove={(e) => dragging.current && travel(e.clientY)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          const moves: Record<string, number> = { ArrowDown: 0.01, ArrowUp: -0.01, PageDown: 0.06, PageUp: -0.06 };
          if (e.key in moves) {
            e.preventDefault();
            e.stopPropagation();
            nudge(moves[e.key]);
          }
        }}
      >
        {ZONES.map((zone) => (
          <div key={zone.key} className="gauge-zone" style={{ top: `${zoneStart(zone) * 100}%`, height: `${zone.share * 100}%` }}>
            <span className="gauge-zone-depth">{zone.top === 0 ? "0 m" : formatDepth(zone.top)}</span>
          </div>
        ))}
        <span className="gauge-bottom">{formatDepth(CHALLENGER_DEEP)}</span>
        {Object.values(lights).map((light) => (
          <i
            key={light.id}
            className="gauge-light"
            style={{ top: `${progressAt(light.depth) * 100}%`, color: wavelengthCss(light.wavelength) }}
          />
        ))}
        {Object.values(divers).map((diver) => (
          <i key={diver.id} className="gauge-diver" style={{ top: `${progressAt(diver.depth) * 100}%` }} />
        ))}
        <div ref={you} className="gauge-you">
          <span ref={label} />
        </div>
      </div>
    </div>
  );
}
