// Values that change every frame live here, outside React, so that moving
// through the water never re-renders a component. The scene and the HUD read
// them in their own animation loops.

import { clamp, depthAt } from "./ocean";

export const motion = {
  progress: 0,
  target: 0,
  velocity: 0,
  depth: 0,
  // Pointer in normalised device coordinates, and how fast it's moving.
  pointer: { x: 0, y: -0.2 },
  pointerSpeed: 0,
  reducedMotion: false,
};

export const now = () => performance.now() / 1000;

export function nudge(amount: number) {
  motion.target = clamp(motion.target + amount, 0, 1);
}

export function diveTo(progress: number) {
  motion.target = clamp(progress, 0, 1);
}

export function step(dt: number) {
  const ease = motion.reducedMotion ? 1 - Math.exp(-dt * 10) : 1 - Math.exp(-dt * 2.6);
  const before = motion.progress;
  motion.progress += (motion.target - motion.progress) * ease;
  if (Math.abs(motion.target - motion.progress) < 1e-6) motion.progress = motion.target;
  motion.velocity = dt > 0 ? (motion.progress - before) / dt : 0;
  motion.depth = depthAt(motion.progress);
  motion.pointerSpeed *= Math.exp(-dt * 6);
}
