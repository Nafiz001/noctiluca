"use client";

import * as THREE from "three";

import { sparkle } from "../Plankton";
import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// Melanocetus johnsonii: a dark round body you only see in the lamp, a
// mouthful of glassy teeth, and a lure lit by the bacteria living inside it.
function build() {
  const s = new ShapeBuilder();
  // Body.
  while (s.positions.length < 1100 * 3) {
    const u = rand(-1, 1);
    const a = rand(0, TAU);
    const r = Math.sqrt(1 - u * u);
    const x = u * 1.15 + 0.3;
    const tail = x > 1.1 ? 1 - (x - 1.1) * 1.6 : 1;
    const shell = Math.random() < 0.7 ? 1 : Math.random();
    const y = r * Math.cos(a) * tail * shell;
    // Leave the gaping mouth open.
    if (x < -0.2 && y > -0.75 && y < 0.3) continue;
    s.add([x, y, r * Math.sin(a) * 0.75 * tail * shell], [0, u, a, Math.random()]);
  }
  // Tail fin.
  for (let i = 0; i < 90; i++) {
    const f = Math.random();
    s.add([1.3 + f * 0.7, rand(-1, 1) * (0.15 + f * 0.45), 0], [0, 1, 0, Math.random()]);
  }
  // Upper and lower jaws (placed in the shader, so they can gape), each
  // lined with long glassy teeth.
  for (const jaw of [1, -1]) {
    for (let i = 0; i < 34; i++) s.add([0, 0, 0], [1, jaw, 0, Math.random()], [0, i / 33, 0]);
    for (let k = 0; k < 10; k++) {
      const f = 0.15 + (k / 9) * 0.8;
      for (let j = 1; j <= 4; j++) s.add([0, 0, 0], [1, jaw, 0, Math.random()], [0, f, j / 4]);
    }
  }
  // Rod.
  for (let i = 0; i < 50; i++) s.add([0, 0, 0], [2, i / 49, 0, Math.random()]);
  // Lure.
  for (let i = 0; i < 40; i++) {
    const a = rand(0, TAU);
    const b = rand(0, Math.PI);
    const r = Math.random() * 0.13;
    s.add([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], [3, 0, 0, Math.random()]);
  }
  s.add([0, 0, 0], [4, 0, 0, 0.5]);
  return s;
}

const vertex = glsl`
vec3 rodAt(float f, float t) {
  vec3 base = vec3(-0.6, 0.85, 0.0);
  float bob = sin(t * 0.9) * 0.2;
  return base + vec3(-f * 1.5 - f * f * 0.3, f * 1.0 - f * f * (1.3 - bob), sin(t * 0.6) * 0.2 * f);
}

void main() {
  float kind = aData.x;
  float seed = aData.w;
  float t = uTime;
  float snap = step(0.0, uDisplay) * exp(-uDisplay * 2.5) * sin(min(uDisplay * 9.0, 3.1416));
  vec3 p = position;

  if (kind > 0.5 && kind < 1.5) {
    float gape = clamp(0.6 + 0.12 * sin(t * 0.5) - snap * 0.55, 0.05, 1.0);
    float jaw = aData.y;
    float f = aExtra.y;
    vec2 hinge = vec2(-0.45, -0.2);
    vec2 tip = jaw > 0.0 ? vec2(-1.35, 0.15 + gape * 0.3) : vec2(-1.3, -0.3 - gape * 0.6);
    vec2 along = tip - hinge;
    vec2 outward = normalize(vec2(-along.y, along.x)) * jaw;
    vec2 edge = hinge + along * f + outward * sin(f * 3.1416) * 0.1;
    // Teeth point into the mouth.
    edge -= outward * aExtra.z * 0.22 * sqrt(sin(f * 3.1416));
    p = vec3(edge, (seed - 0.5) * 0.5 * sin(f * 3.1416));
  } else if (kind > 1.5 && kind < 2.5) {
    p = rodAt(aData.y, t);
  } else if (kind > 2.5) {
    p = rodAt(1.0, t) + position;
  }
  p.xz = rot2(0.35 + sin(t * 0.1) * 0.15) * p.xz;
  vec3 world = uOrigin + p * uScale;

  float size = kind > 3.5 ? 1.1 : (kind > 2.5 ? 0.07 : (kind > 0.5 && kind < 1.5 ? 0.034 : 0.045));
  float lamp = place(world, size * uScale);

  vec3 col = vec3(0.4, 0.32, 0.3) * (0.03 + lamp * 1.0);
  if (kind > 0.5 && kind < 1.5) col = vec3(0.85, 0.9, 0.95) * (0.04 + lamp * 0.8) * (aExtra.z > 0.0 ? 1.0 : 0.6);
  if (kind > 1.5 && kind < 2.5) col = vec3(0.5, 0.6, 0.7) * (0.02 + lamp * 0.6);
  float breathe = 0.75 + 0.25 * sin(t * 1.3) + snap * 2.0;
  if (kind > 2.5 && kind < 3.5) col = vec3(0.45, 0.85, 1.0) * 1.6 * breathe;
  if (kind > 3.5) col = vec3(0.2, 0.55, 1.0) * 0.12 * breathe;
  vColor = col;
}
`;

const lureOffset = new THREE.Vector3();

export function Anglerfish({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "anglerfish",
    depth,
    x: 6.5,
    z: -15,
    scale: 1.4,
    radius: 2.2,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.06) * 0.8;
      o.y += Math.sin(t * 0.4) * 0.15;
    },
    onFrame: (t, o) => {
      // Tiny animals drawn to the lure.
      if (Math.random() < 0.08) {
        lureOffset.set(-2.4, 0.6, 0).multiplyScalar(1.4).add(o);
        sparkle(lureOffset, 1, { spread: 1.8, speed: 0.2, life: 2.5 });
      }
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
