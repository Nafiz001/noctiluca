"use client";

import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// Praya dubia: not one animal but a colony, strung out along a stem longer
// than a blue whale. Light runs along it in slow pulses; touched, a bright
// wave travels the whole length.
const LENGTH = 92;
const GROUPS = 84;

function build() {
  const s = new ShapeBuilder();
  // Two rounded swimming bells at the front, hollow cups facing each other,
  // each with a muscular opening that glows faintly at the rim.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 700; i++) {
      const u = Math.pow(Math.random(), 0.8); // 0 at the closed end, 1 at the opening
      const a = rand(0, TAU);
      const r = 1.25 * Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.5) * (1 - u * 0.25);
      const along = (1 - Math.cos(u * Math.PI * 0.5)) * 2.4;
      s.add([-1.2 - r * Math.cos(a) * 0.9, side * (2.6 - along), r * Math.sin(a)], [0, u, a, Math.random()], [0, 0, side]);
    }
  }
  // The stem.
  for (let i = 0; i < 1400; i++) s.add([0, 0, 0], [1, i / 1399, 0, Math.random()], [i / 1399, 0, 0]);
  // Repeating groups of zooids, each with a trailing tentacle.
  for (let g = 0; g < GROUPS; g++) {
    const at = 0.03 + (g / GROUPS) * 0.97;
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const r = Math.pow(Math.random(), 0.6) * 0.32;
      s.add([r * Math.cos(a) * 1.4, -Math.abs(r * Math.sin(a)) - 0.05, rand(-0.25, 0.25)], [2, at, a, Math.random()], [at, 0, 0]);
    }
    for (let j = 0; j < 14; j++) s.add([0, 0, 0], [3, at, j / 13, Math.random()], [at, j / 13, 0]);
  }
  return s;
}

const vertex = glsl`
vec3 stemAt(float s, float t) {
  float x = s * ${LENGTH.toFixed(1)};
  float y = sin(s * 3.1 + t * 0.12) * 3.2 - s * 5.0 + sin(s * 22.0 - t * 0.9) * 0.35;
  float z = cos(s * 2.3 + t * 0.09) * 6.0 - s * 10.0;
  return vec3(x, y, z);
}

void main() {
  float kind = aData.x;
  float seed = aData.w;
  float t = uTime;
  vec3 p;
  float s;

  if (kind < 0.5) {
    s = 0.0;
    vec3 q = position;
    q.yz *= 1.0 + 0.08 * sin(t * 1.8 + aExtra.z);
    p = stemAt(0.0, t) + q;
  } else if (kind < 1.5) {
    s = aExtra.x;
    p = stemAt(s, t);
  } else if (kind < 2.5) {
    s = aExtra.x;
    p = stemAt(s, t) + position;
  } else {
    s = aExtra.x;
    float f = aExtra.y;
    p = stemAt(s, t) + vec3(sin(f * 5.0 + t * 0.7 + s * 30.0) * 0.5 * f, -f * 2.6, cos(f * 4.0 + t * 0.5) * 0.3 * f);
  }
  vec3 world = uOrigin + p * uScale;
  float size = kind < 0.5 ? 0.045 : (kind < 1.5 ? 0.06 : (kind < 2.5 ? 0.075 : 0.04));
  float lamp = place(world, size * uScale);

  vec3 blue = vec3(0.16, 0.58, 1.0);
  float pulse = pow(0.5 + 0.5 * sin(s * 46.0 - t * 2.2), 8.0);
  float wave = exp(-pow((s * 9.0 - uDisplay * 2.2) * 1.4, 2.0)) * step(0.0, uDisplay) * (1.0 - smoothstep(4.0, 6.0, uDisplay));
  vec3 col = vec3(0.75, 0.55, 0.5) * (0.02 + lamp * 0.85);
  if (kind < 0.5) col = vec3(0.55, 0.8, 1.0) * (0.04 + lamp * 0.7) + blue * smoothstep(0.8, 1.0, aData.y) * 0.5;
  if (kind > 0.5 && kind < 1.5) col += blue * (0.22 + pulse * 1.1 + wave * 3.2);
  if (kind > 1.5 && kind < 2.5) col += blue * (0.3 + pulse * 1.6 + wave * 4.0) * (0.6 + 0.4 * seed);
  if (kind > 2.5) col += blue * (0.06 + pulse * 0.5 + wave * 1.4) * (1.0 - aData.z);
  vColor = col;
}
`;

export function Siphonophore({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "siphonophore",
    depth,
    x: -30,
    z: -20,
    radius: 6,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.y += 1.5 + Math.sin(t * 0.07) * 1.2;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
