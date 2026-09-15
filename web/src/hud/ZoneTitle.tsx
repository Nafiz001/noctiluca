"use client";

import { useEffect, useRef, useState } from "react";

import { motion } from "@/lib/motion";
import { type Zone, zoneAt } from "@/lib/ocean";
import { useTicker } from "./useTicker";

// Announces each zone as you cross into it.
export function ZoneTitle() {
  const [zone, setZone] = useState<Zone | null>(null);
  const [shownAt, setShownAt] = useState(0);
  const current = useRef<string | null>(null);

  useTicker(() => {
    // A few metres of hysteresis, so hovering on a boundary doesn't flicker.
    const next = zoneAt(motion.depth);
    if (next.key !== zoneAt(motion.depth - 3).key || next.key !== zoneAt(motion.depth + 3).key) return;
    if (next.key !== current.current) {
      current.current = next.key;
      setZone(next);
      setShownAt(performance.now());
    }
  });

  useEffect(() => {
    if (!zone) return;
    const timer = setTimeout(() => setZone(null), 7000);
    return () => clearTimeout(timer);
  }, [zone, shownAt]);

  if (!zone) return null;
  return (
    <div className="zone-title" key={`${zone.key}-${shownAt}`} role="status">
      <h2>{zone.name}</h2>
      <p>{zone.line}</p>
    </div>
  );
}
