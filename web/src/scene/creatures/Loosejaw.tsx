"use client";

import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// Malacosteus niger hunts with a red searchlight that almost nothing else
// can see. The beam shows up as snow caught in red light.
function outline(f: number) {
  // Half-height of the body along its length (0 = snout, 1 = tail).
  return 0.34 * Math.sin(Math.min(1, f * 1.5 + 0.12) * Math.PI * 0.62) * (1 - Math.pow(f, 3)) + 0.02;
}

function build() {
  const s = new ShapeBuilder();
  for (let i = 0; i < 900; i++) {
    const f = Math.random();
    const h = outline(f);
    const v = rand(-1, 1);
    const edge = Math.random() < 0.55;
    s.add([f * 3.4, (edge ? Math.sign(v) : v) * h, rand(-0.12, 0.12) * (1 - f)], [0, f, v, Math.random()]);
  }
  // The long open lower jaw and chin barbel.
  for (let i = 0; i < 70; i++) {
    const f = i / 69;
    s.add([-f * 0.9 + 0.35, -0.3 - f * 0.25, 0], [1, f, 0, Math.random()]);
  }
  for (let i = 0; i < 90; i++) {
    const f = i / 89;
    s.add([0, 0, 0], [2, f, 0, Math.random()]);
  }
  // Red light organ under the eye, and a small blue-green one behind it.
  for (let i = 0; i < 20; i++) {
    const a = rand(0, TAU);
    const r = Math.random() * 0.07;
    s.add([0.34 + r * Math.cos(a), -0.08 + r * Math.sin(a), 0.14], [3, 0, 0, Math.random()]);
  }
  for (let i = 0; i < 10; i++) {
    const a = rand(0, TAU);
    const r = Math.random() * 0.04;
    s.add([0.6 + r * Math.cos(a), 0.06 + r * Math.sin(a), 0.14], [4, 0, 0, Math.random()]);
  }
  // The searchlight.
  for (let i = 0; i < 1600; i++) {
    const along = Math.pow(Math.random(), 0.7);
    const a = rand(0, TAU);
    const r = Math.sqrt(Math.random());
    s.add([0, 0, 0], [5, along, a, Math.random()], [r, 0, 0]);
  }
  return s;
}

const vertex = glsl`
void main() {
  float kind = aData.x;
  float seed = aData.w;
  float t = uTime;
  float scan = displayEnvelope(0.3, 4.0, 2.0);
  vec3 p = position;

  if (kind < 0.5) {
    p.z += sin(aData.y * 5.0 - t * 1.4) * 0.12 * aData.y;
  } else if (kind > 1.5 && kind < 2.5) {
    float f = aData.y;
    p = vec3(-0.2 + f * 0.6, -0.45 - f * 2.1, sin(f * 6.0 + t) * 0.2 * f);
  } else if (kind > 4.5) {
    float along = aData.y;
    float sweep = sin(t * 0.35) * 0.22 + sin(uDisplay * 1.8) * 0.5 * scan;
    vec2 dir = vec2(-cos(sweep), sin(sweep) - 0.05);
    float spreadR = (0.05 + along * 13.0 * 0.1) * aExtra.x;
    vec3 origin = vec3(0.34, -0.08, 0.14);
    vec3 fwd = vec3(dir, 0.0);
    vec3 side = vec3(-dir.y, dir.x, 0.0);
    p = origin + fwd * along * 13.0 + side * cos(aData.z) * spreadR + vec3(0.0, 0.0, sin(aData.z) * spreadR);
    // Snow drifting through the beam.
    p += vec3(sin(t * 0.3 + seed * 30.0), -mod(t * 0.2 + seed * 7.0, 2.0) + 1.0, cos(t * 0.25 + seed * 20.0)) * 0.12 * along;
  }

  // It swims facing into the screen from the left.
  p.x = -p.x;
  vec3 world = uOrigin + p * uScale;
  float size = kind > 4.5 ? mix(0.07, 0.035, aData.y) : (kind > 2.5 ? 0.07 : 0.04);
  float lamp = place(world, size * uScale);

  vec3 red = vec3(1.0, 0.08, 0.04);
  vec3 col = vec3(0.38, 0.32, 0.32) * (0.07 + lamp * 0.9);
  if (kind > 0.5 && kind < 2.5) col = vec3(0.4, 0.35, 0.35) * (0.08 + lamp * 0.9);
  if (kind > 2.5 && kind < 3.5) col = red * (2.6 + scan * 2.0) + vec3(1.0, 0.5, 0.4) * 0.3;
  if (kind > 3.5 && kind < 4.5) col = vec3(0.2, 1.0, 0.7) * 0.9;
  if (kind > 4.5) {
    float along = aData.y;
    float twinkle = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(t * 1.5 + seed * 60.0), 3.0);
    col = red * pow(1.0 - along, 1.6) * (0.55 + scan * 0.8) * twinkle * mix(1.2, 0.35, aExtra.x);
  }
  vColor = col;
}
`;

export function Loosejaw({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "stoplight-loosejaw",
    depth,
    x: -8,
    z: -16,
    scale: 1.35,
    radius: 2.6,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.05) * 1.5;
      o.y += Math.sin(t * 0.3) * 0.25;
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
