"use client";

import * as THREE from "three";

import { sparkle } from "../Plankton";
import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// Vampyroteuthis infernalis: a dark cloak of webbed arms, blue eyes in the
// lamp, glowing arm tips. Touched, it leaves a cloud of glowing mucus behind
// and slips away.
function build() {
  const s = new ShapeBuilder();
  // Mantle.
  for (let i = 0; i < 700; i++) {
    const u = Math.random();
    const a = rand(0, TAU);
    const y = u * 1.9;
    const r = 0.62 * Math.sqrt(Math.max(0, Math.sin(Math.PI * (0.1 + u * 0.9)))) + 0.05;
    s.add([r * Math.cos(a), y, r * Math.sin(a)], [0, u, a, Math.random()]);
  }
  // Two ear-like fins.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 110; i++) {
      const f = Math.random();
      const w = Math.sqrt(Math.sin(f * Math.PI)) * 0.35 * Math.random();
      s.add([side * (0.5 + f * 0.8), 1.45 + w - 0.15, rand(-0.05, 0.05)], [1, f, side, Math.random()]);
    }
  }
  // Arms, with the web between them.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    for (let j = 0; j < 36; j++) s.add([0, 0, 0], [2, j / 35, a, Math.random()], [k, j / 35, 0]);
    for (let j = 0; j < 70; j++) {
      const f = Math.pow(Math.random(), 0.8);
      s.add([0, 0, 0], [3, f, a + Math.random() * (TAU / 8), Math.random()], [k, f, 0]);
    }
  }
  // Eyes.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const r = Math.random() * 0.1;
      const b = rand(0, TAU);
      s.add([side * 0.38 + r * Math.cos(b), 0.25 + r * Math.sin(b), 0.52], [4, 0, side, Math.random()]);
    }
  }
  // Light organs at the arm tips and behind the fins.
  for (let k = 0; k < 8; k++) s.add([0, 0, 0], [5, 1, (k / 8) * TAU, Math.random()], [k, 1, 0]);
  for (const side of [-1, 1]) s.add([side * 0.45, 1.25, 0.3], [6, 0, side, Math.random()]);
  return s;
}

const vertex = glsl`
void main() {
  float kind = aData.x;
  float seed = aData.w;
  float t = uTime;
  float flee = displayEnvelope(0.1, 3.5, 3.0);
  float spread = 0.75 + 0.25 * sin(t * 0.8);
  vec3 p = position;

  if (kind > 0.5 && kind < 1.5) {
    float flap = sin(t * 1.6) * 0.35;
    p.xy = vec2(aData.z * 0.5, 1.3) + rot2(-aData.z * flap) * (p.xy - vec2(aData.z * 0.5, 1.3));
  } else if (kind > 1.5 && kind < 3.5 || kind > 4.5 && kind < 5.5) {
    float f = aExtra.y;
    float a = aData.z;
    float reach = 2.3 * f;
    float open = mix(0.35, 1.25, spread) * (1.0 - flee * 0.7);
    vec3 dir = normalize(vec3(cos(a) * open, -1.0, sin(a) * open));
    p = dir * reach + vec3(0.0, -0.05, 0.0);
    p += vec3(cos(a), 0.0, sin(a)) * sin(t * 1.1 + a * 2.0 + f * 3.0) * 0.12 * f;
    if (kind > 2.5 && kind < 3.5) p *= mix(0.55, 0.95, seed);
  }
  p.yz = rot2(-0.35) * p.yz;
  p.xz = rot2(sin(t * 0.15) * 0.6) * p.xz;
  vec3 world = uOrigin + p * uScale;

  float size = kind > 4.5 ? 0.12 : (kind > 3.5 ? 0.06 : 0.042);
  float lamp = place(world, size * uScale);

  vec3 cloak = vec3(0.45, 0.07, 0.08);
  vec3 blue = vec3(0.2, 0.62, 1.0);
  vec3 col = cloak * (0.012 + lamp * 1.25);
  if (kind > 3.5 && kind < 4.5) col = vec3(0.25, 0.7, 1.0) * (0.02 + lamp * 3.0);
  if (kind > 4.5 && kind < 5.5) {
    float flicker = 0.5 + 0.5 * sin(t * 2.3 + aData.z * 5.0);
    col = blue * (0.25 + flicker * 0.5) * (1.0 - flee) + blue * exp(-uDisplay * 3.0) * 4.0 * step(0.0, uDisplay);
  }
  if (kind > 5.5) col = blue * (0.35 + 0.25 * sin(t * 0.6 + aData.z));
  vColor = col;
}
`;

export function VampireSquid({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "vampire-squid",
    depth,
    x: -5.5,
    z: -18,
    scale: 1.2,
    radius: 2.4,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o, state) => {
      const age = t - state.displayAt;
      const away = age > 0 ? Math.min(1, age / 1.2) * Math.exp(-Math.max(0, age - 4) * 0.25) : 0;
      o.x += Math.sin(t * 0.1) * 1.1 - away * 7;
      o.y += Math.sin(t * 0.8) * 0.2 + away * 2.5;
    },
    onFrame: (t, o, state) => {
      const age = t - state.displayAt;
      if (age > 0 && age < 0.9) {
        // Mucus leaves the arm tips in thick puffs, then hangs glowing.
        sparkle(new THREE.Vector3(o.x + 1.2, o.y - 1.2, o.z), 60, {
          spread: 1.2,
          speed: 1.1,
          life: 10,
          color: [0.22, 0.66, 1.0],
        });
      }
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
