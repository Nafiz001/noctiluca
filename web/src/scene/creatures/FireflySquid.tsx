"use client";

import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// A small school of firefly squid, each dotted with light organs. They
// flash together in slow waves; touched, the flash runs through the school.
const SQUID = 11;

function build() {
  const s = new ShapeBuilder();
  for (let q = 0; q < SQUID; q++) {
    // Mantle: a cone pointing back along +x.
    for (let i = 0; i < 150; i++) {
      const f = Math.random();
      const r = 0.2 * Math.pow(1 - f, 0.7) + 0.02;
      const a = rand(0, TAU);
      s.add([f * 1.3, r * Math.cos(a), r * Math.sin(a)], [0, f, a, Math.random()], [q, 0, 0]);
    }
    // Fins at the tail.
    for (let i = 0; i < 40; i++) {
      const f = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      s.add([1.0 + f * 0.3, 0, side * (0.05 + (1 - f) * 0.22 * Math.random())], [1, f, side, Math.random()], [q, 0, 0]);
    }
    // Arms reaching forward.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      for (let j = 0; j < 14; j++) {
        const f = j / 13;
        s.add([-0.1 - f * 0.55, 0.09 * Math.cos(a) * (1 + f), 0.09 * Math.sin(a) * (1 + f)], [2, f, a, Math.random()], [q, f, k]);
      }
    }
    // Three bright organs on the tip of each of the two ventral arms.
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        s.add([-0.5 - j * 0.07, -0.13 - j * 0.02, side * (0.1 + j * 0.02)], [3, j / 2, side, Math.random()], [q, 0, 0]);
      }
    }
    // Hundreds of tiny organs along the belly (a representative few dozen).
    for (let i = 0; i < 46; i++) {
      const f = Math.random();
      const a = rand(-2.4, -0.7);
      const r = 0.21 * Math.pow(1 - f, 0.7) + 0.02;
      s.add([f * 1.2, r * Math.sin(a), r * Math.cos(a) * 0.8], [4, f, a, Math.random()], [q, 0, 0]);
    }
  }
  return s;
}

const vertex = glsl`
void main() {
  float kind = aData.x;
  float seed = aData.w;
  float q = aExtra.x;
  float t = uTime;

  vec3 offset = vec3(sin(q * 2.13) * 2.4, cos(q * 1.71) * 1.3, sin(q * 3.37) * 1.4);
  offset += vec3(sin(t * 0.3 + q) * 0.3, sin(t * 0.8 + q * 1.3) * 0.18, cos(t * 0.25 + q) * 0.3);

  vec3 p = position;
  // Pulse the mantle and let the arms trail.
  p.yz *= 1.0 + 0.1 * sin(t * 2.4 + q) * (kind < 0.5 ? 1.0 : 0.3);
  if (kind > 1.5 && kind < 2.5) p.y += sin(t * 2.4 + q + aExtra.y * 2.0) * 0.05 * aExtra.y;
  p.xy = rot2(sin(t * 0.2 + q) * 0.15 + 0.1) * p.xy;
  vec3 world = uOrigin + (p + offset) * uScale;

  float size = kind > 2.5 && kind < 3.5 ? 0.06 : (kind > 3.5 ? 0.03 : 0.022);
  float lamp = place(world, size * uScale);

  // A slow wave of flashing across the school, and a fast one when touched.
  float wave = mod(t * 0.16 - q * 0.035, 1.0);
  float synced = exp(-pow((wave - 0.5) * 16.0, 2.0));
  float touched = exp(-pow((uDisplay - 0.15 - q * 0.09) * 5.0, 2.0)) * 2.8;

  vec3 blue = vec3(0.16, 0.55, 1.0);
  vec3 col = vec3(0.75, 0.5, 0.6) * (0.05 + lamp * 0.9);
  if (kind > 2.5 && kind < 3.5) {
    col += blue * (0.7 + synced * 3.0 + touched * 2.0) + vec3(1.0) * (synced + touched) * 0.4;
  } else if (kind > 3.5) {
    float twinkle = 0.5 + 0.5 * sin(t * 3.0 + seed * 40.0);
    col += blue * (0.35 * twinkle + synced * 1.2 + touched * 1.2);
  }
  vColor = col;
}
`;

export function FireflySquid({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "firefly-squid",
    depth,
    x: 5.5,
    z: -18,
    scale: 2.3,
    radius: 4,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.07) * 3;
      o.y += Math.cos(t * 0.11) * 1.2;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
