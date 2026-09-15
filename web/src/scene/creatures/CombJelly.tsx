"use client";

import * as THREE from "three";

import { sparkle } from "../Plankton";
import { glsl } from "../shared";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";

// A lobate comb jelly. The rainbows running down its eight comb rows are the
// diver's lamp diffracting off beating cilia, so they blaze when the lamp
// is on it. Touched, it flashes its own blue light.
function radiusAt(y: number) {
  const body = 0.85 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.1) / 1.35, 2)));
  const lobes = y < -0.3 ? 0.55 * Math.sin(Math.min(1, (-0.3 - y) / 0.9) * Math.PI * 0.8) : 0;
  return body + lobes;
}

function build() {
  const s = new ShapeBuilder();
  for (let i = 0; i < 1300; i++) {
    const y = rand(-1.2, 1.45);
    const theta = rand(0, TAU);
    const r = radiusAt(y) * (Math.random() < 0.8 ? 1 : rand(0.2, 0.95));
    // Squash the lobes into two flaps rather than a full skirt.
    const lobeSquash = y < -0.3 ? 0.55 + 0.45 * Math.abs(Math.cos(theta)) : 1;
    s.add([r * Math.cos(theta), y, r * Math.sin(theta) * lobeSquash], [0, (y + 1.2) / 2.65, theta, Math.random()]);
  }
  for (let k = 0; k < 8; k++) {
    const theta = (k / 8) * TAU + 0.2;
    for (let j = 0; j < 90; j++) {
      const f = j / 89;
      const y = 1.3 - f * 1.9;
      const r = radiusAt(y) + 0.03;
      s.add([r * Math.cos(theta), y, r * Math.sin(theta)], [1, f, theta, Math.random()], [k, f, 0]);
    }
  }
  // A cluster of gut and statocyst at the core.
  for (let i = 0; i < 120; i++) {
    const a = rand(0, TAU);
    const r = Math.pow(Math.random(), 2) * 0.2;
    s.add([r * Math.cos(a), rand(-0.3, 1.2), r * Math.sin(a)], [2, 0, a, Math.random()]);
  }
  return s;
}

const vertex = glsl`
void main() {
  float kind = aData.x;
  float seed = aData.w;
  float t = uTime;
  vec3 p = position;
  p.xz *= 1.0 + 0.04 * sin(t * 0.9 + p.y * 1.4);
  p.xz = rot2(t * 0.22) * p.xz;
  p.xy = rot2(0.25 + sin(t * 0.13) * 0.12) * p.xy;
  vec3 world = uOrigin + p * uScale;
  float lamp = place(world, (kind > 0.5 && kind < 1.5 ? 0.07 : 0.045) * uScale);

  float flash = displayEnvelope(0.08, 0.6, 2.2);
  vec3 blue = vec3(0.2, 0.6, 1.0);
  vec3 col;
  if (kind < 0.5) {
    col = vec3(0.5, 0.75, 0.9) * (0.018 + lamp * 0.55) + blue * flash * (0.25 + 0.75 * pow(0.5 + 0.5 * sin(aData.y * 20.0 - uDisplay * 14.0), 4.0));
  } else if (kind < 1.5) {
    float f = aExtra.y;
    float hue = fract(f * 1.6 - t * 0.45 + aExtra.x * 0.125);
    float beat = pow(0.5 + 0.5 * sin(f * 60.0 - t * 14.0), 2.0);
    vec3 rainbow = hsv2rgb(vec3(hue, 0.9, 1.0));
    col = rainbow * (0.1 + lamp * 3.2) * (0.25 + beat) + blue * flash * 1.4;
  } else {
    col = vec3(1.0, 0.55, 0.4) * (0.02 + lamp * 0.9);
  }
  vColor = col;
}
`;

export function CombJelly({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "comb-jelly",
    depth,
    x: -7.5,
    z: -17,
    scale: 1.25,
    radius: 1.8,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.09) * 1.5;
      o.y += Math.sin(t * 0.23) * 0.7;
    },
    onFrame: (t, o, state) => {
      const age = t - state.displayAt;
      if (age > 0 && age < 0.05) {
        sparkle(new THREE.Vector3(o.x, o.y, o.z), 120, { spread: 1.4, speed: 1.6, life: 2.2 });
      }
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
