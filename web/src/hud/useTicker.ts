"use client";

import { useEffect, useRef } from "react";

// Run a callback every animation frame for as long as the component lives.
// For DOM that tracks per-frame motion without going through React state.
export function useTicker(callback: (dt: number) => void) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (t: number) => {
      ref.current(Math.min(0.1, (t - last) / 1000));
      last = t;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
}
