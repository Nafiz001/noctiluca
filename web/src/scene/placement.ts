import * as THREE from "three";

import { worldY } from "@/lib/ocean";

// Where a light hangs in the water. The server gives each light a drift and a
// phase so every diver sees it in the same place; the shader in Lights.tsx
// repeats this exactly, so what you point at is what you see.

export const lightZ = (phase: number) => -12 - ((phase * 7.31) % 1) * 20;

export function lightPosition(
  light: { depth: number; drift: number; phase: number },
  time: number,
  spread: number,
  out: THREE.Vector3,
) {
  const z = lightZ(light.phase);
  const x = light.drift * spread * -z * 0.82;
  return out.set(
    x + Math.sin(time * 0.13 + light.phase * 40) * 0.35,
    worldY(light.depth) + Math.sin(time * 0.21 + light.phase * 17) * 0.45,
    z,
  );
}

export const DIVER_Z = -26;

export function diverPosition(diver: { depth: number; x: number }, spread: number, out: THREE.Vector3) {
  return out.set(diver.x * spread * -DIVER_Z * 0.85, worldY(diver.depth), DIVER_Z);
}
