"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { motion, now } from "@/lib/motion";
import { useSea } from "@/lib/store";
import { glsl, shared } from "./shared";

// Sea sparkle. Every moving thing in the water sets off flashes of blue light:
// the pointer, lights being born, animals putting on displays. Sparks are
// written into a ring buffer on the CPU and animated entirely on the GPU.
const COUNT = 6000;

const vertex = glsl`
uniform float uTime;
uniform float uProjScale;
attribute vec3 aVelocity;
attribute vec3 aColor;
attribute vec3 aTiming; // born, life, seed
varying vec3 vColor;
varying float vAlpha;

void main() {
  float age = uTime - aTiming.x;
  float life = aTiming.y;
  if (age < 0.0 || age > life) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  float seed = aTiming.z;
  float glide = (1.0 - exp(-age * 1.6)) / 1.6;
  vec3 p = position + aVelocity * glide;
  p.x += sin(age * 1.3 + seed * 30.0) * 0.08 * age;
  p.y += age * 0.05;

  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.5);

  float t = age / life;
  float flash = smoothstep(0.0, 0.04, age) * pow(1.0 - t, 2.2);
  float twinkle = 0.75 + 0.25 * sin(age * 22.0 + seed * 50.0);
  vColor = mix(aColor, vec3(1.0), exp(-age * 6.0) * 0.6);
  vAlpha = flash * twinkle;
  gl_PointSize = max(1.5, (0.05 + seed * 0.06) * uProjScale / dist) * (0.6 + flash);
}
`;

const fragment = glsl`
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv) * 2.0;
  if (r > 1.0) discard;
  float glow = exp(-r * r * 5.0);
  float core = exp(-r * r * 40.0);
  gl_FragColor = vec4(vColor * (glow * 1.1 + core * 2.2) * vAlpha, 1.0);
}
`;

type Buffers = {
  position: THREE.BufferAttribute;
  velocity: THREE.BufferAttribute;
  color: THREE.BufferAttribute;
  timing: THREE.BufferAttribute;
  cursor: number;
};

let buffers: Buffers | null = null;

export type SparkOptions = {
  spread?: number;
  speed?: number;
  life?: number;
  color?: THREE.Color | [number, number, number];
  hueJitter?: number;
  direction?: THREE.Vector3;
};

const SEA_SPARKLE = new THREE.Color("#4fd2ff");
const tmp = new THREE.Color();

// Set off `count` sparks around a world position.
export function sparkle(at: THREE.Vector3, count: number, options: SparkOptions = {}) {
  if (!buffers) return;
  const { spread = 0.6, speed = 0.8, life = 1.8, hueJitter = 0.06, direction } = options;
  const base = Array.isArray(options.color)
    ? tmp.setRGB(...options.color)
    : (options.color ?? SEA_SPARKLE);
  const t = now();
  const { position, velocity, color, timing } = buffers;

  for (let n = 0; n < count; n++) {
    const i = buffers.cursor;
    buffers.cursor = (buffers.cursor + 1) % COUNT;

    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = spread * Math.cbrt(Math.random());
    position.setXYZ(i, at.x + r * s * Math.cos(theta), at.y + r * u, at.z + r * s * Math.sin(theta));

    const v = speed * (0.3 + Math.random() * 0.7);
    let vx = s * Math.cos(theta) * v;
    let vy = u * v;
    let vz = s * Math.sin(theta) * v * 0.5;
    if (direction) {
      vx += direction.x;
      vy += direction.y;
      vz += direction.z;
    }
    velocity.setXYZ(i, vx, vy, vz);

    const j = (Math.random() - 0.5) * hueJitter;
    color.setXYZ(i, Math.max(0, base.r - j), Math.max(0, base.g + j * 0.5), Math.max(0, base.b + j));
    timing.setXYZ(i, t + Math.random() * 0.08, life * (0.6 + Math.random() * 0.8), Math.random());
  }
  position.needsUpdate = true;
  velocity.needsUpdate = true;
  color.needsUpdate = true;
  timing.needsUpdate = true;
}

// How much the plankton flashes on its own, by depth: plenty near the
// surface, a scattering in the midwater, almost none in the trenches.
function ambientRate(depth: number) {
  if (depth < 200) return 7;
  if (depth < 1000) return 3.5;
  if (depth < 4000) return 2;
  if (depth < 6000) return 0.6;
  return 0.25;
}

export function Plankton() {
  const camera = useThree((s) => s.camera);
  const phase = useSea((s) => s.phase);

  const { geometry, material, attrs } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const velocity = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const timingArray = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) timingArray[i * 3] = -1000;
    const timing = new THREE.BufferAttribute(timingArray, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("aVelocity", velocity);
    geometry.setAttribute("aColor", color);
    geometry.setAttribute("aTiming", timing);

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: shared.uTime, uProjScale: shared.uProjScale },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, attrs: { position, velocity, color, timing } };
  }, []);

  useEffect(() => {
    buffers = { ...attrs, cursor: 0 };
    return () => {
      buffers = null;
    };
  }, [attrs]);

  const scratch = useMemo(
    () => ({ ndc: new THREE.Vector3(), dir: new THREE.Vector3(), at: new THREE.Vector3(), push: new THREE.Vector3(), last: { x: 0, y: 0 }, ambient: 0, trail: 0 }),
    [],
  );

  useFrame((_, dt) => {
    const { ndc, dir, at, push, last } = scratch;
    const px = motion.pointer.x;
    const py = motion.pointer.y;
    const fromX = last.x;
    const fromY = last.y;
    const moved = Math.hypot(px - fromX, py - fromY);
    last.x = px;
    last.y = py;

    // A trail behind the pointer, denser the faster it moves, spread along the
    // path it took since the last frame.
    scratch.trail += Math.min(moved * 260, 18) * (motion.reducedMotion ? 0.3 : 1);
    while (scratch.trail >= 1) {
      scratch.trail -= 1;
      const k = Math.random();
      ndc
        .set(fromX + (px - fromX) * k + (Math.random() - 0.5) * 0.02, fromY + (py - fromY) * k + (Math.random() - 0.5) * 0.02, 0.5)
        .unproject(camera);
      dir.copy(ndc).sub(camera.position).normalize();
      at.copy(camera.position).addScaledVector(dir, 8 + Math.random() * 14);
      push.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0);
      sparkle(at, 1, { spread: 0.35, speed: 0.25, life: 1.4 + Math.random(), direction: push });
    }

    // Plankton flashing on its own in the dark around you.
    const surfaceBoost = phase === "surface" ? 1.6 : 1;
    scratch.ambient += ambientRate(motion.depth) * surfaceBoost * dt;
    while (scratch.ambient >= 1) {
      scratch.ambient -= 1;
      ndc.set(Math.random() * 2.2 - 1.1, Math.random() * 2.2 - 1.1, 0.5).unproject(camera);
      dir.copy(ndc).sub(camera.position).normalize();
      at.copy(camera.position).addScaledVector(dir, 8 + Math.random() * 40);
      const burst = Math.random() < 0.15 ? 6 + Math.floor(Math.random() * 10) : 1 + Math.floor(Math.random() * 3);
      sparkle(at, burst, { spread: 0.5, speed: 0.3, life: 1.2 + Math.random() * 1.6 });
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
