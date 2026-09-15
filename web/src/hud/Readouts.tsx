"use client";

import { useRef } from "react";

import { motion } from "@/lib/motion";
import { formatDaylight, formatDepth, pressureBarAt, temperatureAt } from "@/lib/ocean";
import { useTicker } from "./useTicker";

// What the instruments say, at wherever you are right now.
export function Readouts() {
  const depth = useRef<HTMLElement>(null);
  const temp = useRef<HTMLElement>(null);
  const pressure = useRef<HTMLElement>(null);
  const daylight = useRef<HTMLElement>(null);
  const last = useRef(-1);

  useTicker(() => {
    const d = motion.depth;
    if (Math.abs(d - last.current) < 0.05) return;
    last.current = d;
    if (depth.current) depth.current.textContent = formatDepth(d);
    if (temp.current) temp.current.textContent = `${temperatureAt(d).toFixed(1)} °C`;
    if (pressure.current) pressure.current.textContent = `${pressureBarAt(d).toLocaleString("en-US", { maximumFractionDigits: 0 })} bar`;
    if (daylight.current) daylight.current.textContent = formatDaylight(d);
  });

  return (
    <dl className="readouts" aria-live="off">
      <div className="readout readout-depth">
        <dt>Depth</dt>
        <dd ref={depth}>0 m</dd>
      </div>
      <div className="readout">
        <dt>Water</dt>
        <dd ref={temp}>28.5 °C</dd>
      </div>
      <div className="readout">
        <dt>Pressure</dt>
        <dd ref={pressure}>1 bar</dd>
      </div>
      <div className="readout">
        <dt title="The share of surface daylight that reaches this depth at noon">Daylight at noon</dt>
        <dd ref={daylight}>100%</dd>
      </div>
    </dl>
  );
}
