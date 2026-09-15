"use client";

import { FLOOR_Y } from "../Seafloor";
import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// The animals that make no light at all. Without the lamp on them they're
// nothing but a faint suggestion; you find them by searching the dark.

// ---------------------------------------------------------------- dumbo octopus

function buildDumbo() {
  const s = new ShapeBuilder();
  for (let i = 0; i < 900; i++) {
    const u = Math.random();
    const a = rand(0, TAU);
    const r = 0.95 * Math.sqrt(Math.sin(u * Math.PI * 0.5 + 0.02)) * (1 - u * 0.25);
    s.add([r * Math.cos(a), 1.3 - u * 1.3 + (1 - Math.cos(u * 1.6)) * -0.1, r * Math.sin(a)], [0, u, a, Math.random()]);
  }
  // Ear-like fins, attached at the sides of the mantle.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 180; i++) {
      const f = Math.pow(Math.random(), 0.8);
      const w = Math.sin(f * Math.PI * 0.9 + 0.1) * 0.34 * (1 - f * 0.3) * rand(-1, 1);
      s.add([side * (0.7 + f * 0.75), 0.9 + w + f * 0.15, 0], [1, f, side, Math.random()]);
    }
  }
  // Eight arms joined by a web most of their length, tips curling outward.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    for (let j = 0; j < 44; j++) s.add([0, 0, 0], [2, j / 43, a, Math.random()], [0, 0, 1]);
    for (let j = 0; j < 70; j++) {
      s.add([0, 0, 0], [2, Math.pow(Math.random(), 0.9) * 0.72, a + Math.random() * (TAU / 8), Math.random()], [0, 0, 0]);
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const r = Math.random() * 0.09;
      const b = rand(0, TAU);
      s.add([side * 0.42 + r * Math.cos(b), 0.35 + r * Math.sin(b), 0.8], [3, 0, side, Math.random()]);
    }
  }
  return s;
}

const dumboVertex = glsl`
void main() {
  float kind = aData.x;
  float t = uTime;
  vec3 p = position;
  float stroke = sin(t * 1.5);
  if (kind > 0.5 && kind < 1.5) {
    vec2 pivot = vec2(aData.z * 0.7, 0.9);
    p.xy = pivot + rot2(-aData.z * stroke * 0.5) * (p.xy - pivot);
  } else if (kind > 1.5 && kind < 2.5) {
    float f = aData.y;
    float a = aData.z;
    float open = 0.55 + 0.3 * sin(t * 0.75);
    vec3 radial = vec3(cos(a), 0.0, sin(a));
    // Down and out, then curling back up and out at the tips.
    p = vec3(0.0, 0.15, 0.0) + radial * (f * (0.9 + open)) + vec3(0.0, -f * 1.5 + f * f * f * 1.3 * open, 0.0);
    p += radial * aExtra.z * f * f * f * 0.5;
  }
  p.yz = rot2(-0.25) * p.yz;
  p.xz = rot2(sin(t * 0.12) * 0.5) * p.xz;
  vec3 world = uOrigin + p * uScale;
  float lamp = place(world, (kind > 2.5 ? 0.07 : 0.05) * uScale);
  vec3 skin = vec3(1.0, 0.62, 0.5);
  vec3 col = skin * (0.004 + lamp * 1.4);
  if (kind > 2.5) col = vec3(0.1, 0.08, 0.1) + vec3(0.9, 0.9, 1.0) * lamp * 0.5;
  vColor = col;
}
`;

export function DumboOctopus({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "dumbo-octopus",
    depth,
    x: -5,
    z: -15,
    scale: 1.3,
    radius: 2.2,
    glows: false,
    hasDisplay: false,
    vertex: dumboVertex,
    build: buildDumbo,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.08) * 1.8;
      o.y += Math.sin(t * 1.5 - 1) * 0.12 + Math.sin(t * 0.2) * 0.6;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------- snailfish

// Body radius along the fish: a big soft head, then a long tapering tail.
function snailfishRadius(f: number) {
  const head = 0.72 * Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.13) / 0.15, 2)));
  const body = f > 0.12 ? 0.6 * Math.pow(Math.max(0, 1 - (f - 0.12) / 0.88), 1.15) : 0;
  return Math.max(head, body) + 0.01;
}

function buildSnailfish() {
  const s = new ShapeBuilder();
  for (let i = 0; i < 1500; i++) {
    const f = Math.random();
    const a = rand(0, TAU);
    const r = snailfishRadius(f);
    const shell = Math.random() < 0.7 ? 1 : Math.random();
    s.add([f * 4.2, r * Math.cos(a) * shell, r * Math.sin(a) * 0.8 * shell], [0, f, a, Math.random()]);
  }
  // Long soft dorsal and anal fins running to the tail.
  for (const side of [1, -1]) {
    for (let i = 0; i < 260; i++) {
      const f = rand(0.3, 1);
      const h = (1 - f) * 0.3 + 0.06;
      s.add([f * 4.2, side * (snailfishRadius(f) + Math.random() * h), 0], [1, f, side, Math.random()]);
    }
  }
  // Fan-like pectoral fins behind the head.
  for (const side of [1, -1]) {
    for (let i = 0; i < 120; i++) {
      const a = rand(-0.9, 0.9);
      const r = Math.sqrt(Math.random()) * 0.65;
      s.add([0.95 + Math.cos(a) * r, -0.15 + Math.sin(a) * r * 0.8, side * 0.55], [1, 0.2, side, Math.random()]);
    }
  }
  // A small tail fin.
  for (let i = 0; i < 90; i++) {
    const f = Math.random();
    s.add([4.15 + f * 0.45, rand(-1, 1) * (0.08 + f * 0.3), 0], [1, 1, 0, Math.random()]);
  }
  // Eyes: a ring that catches the lamp.
  for (const side of [1, -1]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      s.add([0.3 + Math.cos(a) * 0.07, 0.22 + Math.sin(a) * 0.07, side * 0.52], [2, 0, 0, Math.random()]);
    }
  }
  return s;
}

const snailfishVertex = glsl`
void main() {
  float kind = aData.x;
  float f = aData.y;
  float t = uTime;
  vec3 p = position;
  p.z += sin(f * 5.5 - t * 2.4) * 0.3 * f * f;
  // Seen three-quarters on, so it has a body rather than a flat outline.
  p.xz = rot2(2.55 + sin(t * 0.1) * 0.2) * p.xz;
  vec3 world = uOrigin + p * uScale;
  float lamp = place(world, (kind > 1.5 ? 0.05 : 0.04) * uScale);
  vec3 skin = vec3(1.0, 0.78, 0.76);
  // Translucent: the head holds the light, the tail lets it through.
  float body = mix(1.5, 0.45, smoothstep(0.1, 1.0, f));
  vec3 col = skin * (0.003 + lamp * (kind > 0.5 && kind < 1.5 ? 0.7 : body));
  if (kind > 1.5) col = vec3(0.7, 0.85, 1.0) * (0.01 + lamp * 1.1);
  vColor = col;
}
`;

export function Snailfish({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "snailfish",
    depth,
    x: 4.5,
    z: -14,
    scale: 1.35,
    radius: 2.4,
    glows: false,
    hasDisplay: false,
    vertex: snailfishVertex,
    build: buildSnailfish,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.07) * 2.2 - 1;
      o.y += Math.sin(t * 0.25) * 0.5;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------------------------------------------------------------- amphipods

const AMPHIPODS = 34;

function buildAmphipods() {
  const s = new ShapeBuilder();
  for (let q = 0; q < AMPHIPODS; q++) {
    for (let i = 0; i < 30; i++) {
      const f = i / 29;
      const a = -0.4 + f * 2.6;
      const r = 0.22;
      const w = 0.07 * Math.sin(f * Math.PI) + 0.02;
      s.add([Math.cos(a) * r + rand(-w, w) * 0.3, Math.sin(a) * r * 0.75 + rand(-w, w), rand(-w, w)], [0, f, 0, Math.random()], [q, 0, 0]);
    }
    for (let l = 0; l < 7; l++) {
      for (let j = 0; j < 4; j++) {
        const f = l / 6;
        const a = -0.2 + f * 2.2;
        s.add([Math.cos(a) * (0.22 - j * 0.05), Math.sin(a) * 0.16 - j * 0.05, (j / 3) * 0.08], [1, f, j, Math.random()], [q, 0, 0]);
      }
    }
  }
  return s;
}

const amphipodVertex = glsl`
void main() {
  float q = aExtra.x;
  float t = uTime;
  vec3 home = vec3(sin(q * 12.9898) * 9.0, fract(sin(q * 78.233) * 43758.5) * 1.2 - 0.6, -fract(sin(q * 39.425) * 24634.6) * 10.0);
  float hop = max(0.0, sin(t * (0.6 + fract(q * 0.37)) + q * 3.0));
  home += vec3(sin(t * 0.08 + q) * 1.5, pow(hop, 8.0) * 0.5, cos(t * 0.06 + q * 2.0) * 1.0);
  vec3 p = position;
  p.xy = rot2(sin(q * 5.0) * 3.14) * p.xy;
  if (aData.x > 0.5) p.y += sin(t * 12.0 + aData.y * 6.0 + q) * 0.015;
  vec3 world = uOrigin + (home + p) * uScale;
  float lamp = place(world, 0.028 * uScale);
  vColor = vec3(1.0, 0.9, 0.78) * (0.002 + lamp * 1.5);
}
`;

export function Amphipods({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "amphipod",
    depth,
    x: 0,
    z: -16,
    scale: 1.2,
    radius: 6,
    glows: false,
    hasDisplay: false,
    vertex: amphipodVertex,
    build: buildAmphipods,
    sway: (_, o) => {
      o.y = FLOOR_Y + 1.6;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
