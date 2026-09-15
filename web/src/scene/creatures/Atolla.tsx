"use client";

import * as THREE from "three";

import { sparkle } from "../Plankton";
import { ShapeBuilder, TAU, rand, useCreature } from "./common";
import { glsl } from "../shared";

// Atolla wyvillei: a deep red bell, invisible in the dark, ringed with blue
// photophores. Touched, it throws a spinning wheel of light.
const R = 2.2;
const H = 1.0;

function build() {
  const s = new ShapeBuilder();
  // Bell.
  for (let i = 0; i < 900; i++) {
    const phi = Math.acos(1 - Math.random());
    const theta = rand(0, TAU);
    const f = phi / (Math.PI / 2);
    s.add([R * Math.sin(phi) * Math.cos(theta), H * Math.cos(phi) + 0.05, R * Math.sin(phi) * Math.sin(theta)], [0, f, theta, Math.random()]);
  }
  // Coronal groove.
  for (let i = 0; i < 90; i++) {
    const theta = (i / 90) * TAU;
    const phi = 1.05;
    s.add([R * Math.sin(phi) * Math.cos(theta), H * Math.cos(phi) + 0.05, R * Math.sin(phi) * Math.sin(theta)], [1, 0, theta, Math.random()]);
  }
  // Scalloped lappets around the margin.
  for (let k = 0; k < 22; k++) {
    for (let j = 0; j < 12; j++) {
      const a = ((k + j / 12) / 22) * TAU;
      const sag = Math.sin((j / 12) * Math.PI) * 0.22;
      const rr = R + 0.08 + sag * 0.4;
      s.add([rr * Math.cos(a), -sag, rr * Math.sin(a)], [2, 0, a, Math.random()]);
    }
  }
  // Photophores.
  for (let i = 0; i < 110; i++) {
    const theta = (i / 110) * TAU;
    s.add([R * 1.02 * Math.cos(theta), -0.02, R * 1.02 * Math.sin(theta)], [3, 0, theta, Math.random()]);
  }
  // Short marginal tentacles.
  for (let k = 0; k < 22; k++) {
    const theta = ((k + 0.5) / 22) * TAU;
    for (let j = 0; j < 22; j++) s.add([0, 0, 0], [4, j / 21, theta, Math.random()], [k, j / 21, 0]);
  }
  // The one long trailing tentacle.
  for (let j = 0; j < 160; j++) s.add([0, 0, 0], [5, j / 159, 0.4, Math.random()], [0, j / 159, 0]);
  return s;
}

const vertex = glsl`
void main() {
  float kind = aData.x;
  float theta = aData.z;
  float seed = aData.w;
  float t = uTime;
  float pulse = sin(t * 1.25);
  float squeeze = 1.0 - 0.07 * pulse;
  vec3 p = position;
  vec3 rimDir = vec3(cos(theta), 0.0, sin(theta));

  if (kind < 0.5) {
    p.xz *= mix(1.0, squeeze, aData.y);
    p.y *= 1.0 + 0.06 * pulse;
  } else if (kind < 3.5) {
    p.xz *= squeeze;
  } else if (kind < 4.5) {
    float s = aExtra.y;
    float sway = sin(t * 0.9 + theta * 3.0 - s * 2.5) * 0.35 * s;
    p = rimDir * (${R.toFixed(2)} * squeeze + 0.25 * s) + vec3(sway * 0.4, -s * 1.9, sway);
  } else {
    float s = aExtra.y;
    vec3 base = vec3(cos(0.4), 0.0, sin(0.4)) * ${R.toFixed(2)} * squeeze;
    p = base + vec3(sin(s * 4.0 - t * 0.7) * 1.4 * s + s * 2.0, -s * 11.0, cos(s * 3.0 - t * 0.5) * 1.1 * s);
  }

  // Tilt so we look up at it from below and the ring opens into an ellipse,
  // and turn slowly.
  p.xz = rot2(t * 0.07) * p.xz;
  p.yz = rot2(-1.02) * p.yz;
  vec3 world = uOrigin + p * uScale;

  float alarm = displayEnvelope(0.2, 5.0, 2.5);
  bool ring = kind > 2.5 && kind < 3.5;
  float sizes = ring ? mix(0.09, 0.16, alarm) : (kind < 0.5 ? 0.04 : 0.035);
  float lamp = place(world, sizes * uScale);

  vec3 red = vec3(0.5, 0.04, 0.07);
  vec3 blue = vec3(0.16, 0.6, 1.0);
  float body = kind < 0.5 ? 0.012 + lamp * 1.3 : (kind < 2.5 ? 0.05 + lamp * 1.4 : 0.02 + lamp * 0.9);
  vec3 col = red * body;
  // Under the alarm, the whole bell is lit from its rim.
  col += blue * alarm * (kind < 0.5 ? 0.05 : 0.12);

  if (ring) {
    float idle = 0.25 + 0.9 * pow(0.5 + 0.5 * sin(theta * 2.0 - t * 0.8), 10.0);
    float wheel = pow(0.5 + 0.5 * sin(theta * 3.0 - uDisplay * 7.0), 7.0);
    float strobe = 0.75 + 0.25 * sin(uDisplay * 31.0 + seed * 6.0);
    col = blue * mix(idle, 0.12 + wheel * 9.0 * strobe, alarm) + vec3(0.85, 0.96, 1.0) * alarm * wheel * 1.5;
  }
  vColor = col;
}
`;

const spark = new THREE.Vector3();

export function Atolla({ depth }: { depth: number }) {
  const { geometry, material } = useCreature({
    slug: "atolla",
    depth,
    x: 7,
    z: -22,
    scale: 1.15,
    radius: 3,
    glows: true,
    hasDisplay: true,
    vertex,
    build,
    sway: (t, o) => {
      o.x += Math.sin(t * 0.11) * 1.2;
      o.y += 2.5 + Math.sin(t * 1.25 - 0.8) * 0.18 + Math.sin(t * 0.17) * 0.8;
    },
    onFrame: (t, o, state) => {
      // Sparks thrown off the spinning wheel.
      const age = t - state.displayAt;
      if (age > 0 && age < 5) {
        const a = age * 7 + Math.random() * 0.6;
        spark.set(o.x + Math.cos(a) * 2.8, o.y + Math.sin(a) * 1.5, o.z + Math.sin(a) * 1.2);
        sparkle(spark, 6, { spread: 0.4, speed: 1.8, life: 1.8 });
      }
    },
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
