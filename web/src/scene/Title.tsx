"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { motion, now } from "@/lib/motion";
import { useSea } from "@/lib/store";
import { glsl, shared } from "./shared";

// The name of the sea, written in plankton. The points drift together into
// the word, scatter from the pointer like sea sparkle does, and rise away
// when the dive begins.
const MAX_POINTS = 11000;
const DIST = 18;

async function sampleWord(word: string, family: string): Promise<Float32Array> {
  const w = 1800;
  const h = 520;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Float32Array();

  const font = `360px ${family}`;
  try {
    await document.fonts.load(font, word);
  } catch {
    // Fall back to whatever serif is available.
  }
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillText(word, w / 2, h / 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.strokeText(word, w / 2, h / 2);

  const { data } = ctx.getImageData(0, 0, w, h);
  const hits: number[] = [];
  let minX = w;
  let maxX = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 120) {
        hits.push(x, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  const count = Math.min(MAX_POINTS, hits.length / 2);
  const out = new Float32Array(count * 2);
  const width = Math.max(1, maxX - minX);
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * (hits.length / 2));
    out[i * 2] = (hits[j * 2] - (minX + width / 2)) / width;
    out[i * 2 + 1] = -(hits[j * 2 + 1] - h / 2) / width;
  }
  return out;
}

const vertex = glsl`
uniform float uTime;
uniform float uProjScale;
uniform float uSpread;
uniform float uAspect;
uniform vec2 uPointer;
uniform float uForm;
uniform float uGone;
attribute vec2 aTarget;
attribute vec3 aStart;
attribute vec3 aSeed;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float width = min(uSpread * ${DIST.toFixed(1)} * 2.0 * (uAspect < 1.0 ? 0.88 : 0.62), 34.0);
  vec3 center = vec3(0.0, 2.2 * min(1.0, uAspect), -${DIST.toFixed(1)});

  float delay = aSeed.x * 0.35 + (aTarget.x + 0.5) * 0.5;
  float k = clamp(uForm * 1.85 - delay, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 4.0);

  vec3 target = center + vec3(aTarget * width, (aSeed.y - 0.5) * 0.25);
  target += vec3(sin(uTime * 0.7 + aSeed.y * 30.0), cos(uTime * 0.6 + aSeed.z * 30.0), 0.0) * 0.025;
  vec3 p = mix(center + aStart, target, e);

  float g = clamp(uGone * 1.6 - aSeed.y * 0.6, 0.0, 1.0);
  p += vec3((aSeed.z - 0.5) * 7.0, 3.0 + aSeed.x * 9.0, (aSeed.y - 0.5) * 5.0) * g * g;

  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec2 d = (clip.xy / clip.w - uPointer) * vec2(uAspect, 1.0);
  float near = exp(-dot(d, d) * 70.0) * (1.0 - g);
  p.xy += normalize(d + 1e-5) * near * 0.55;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float twinkle = 0.72 + 0.28 * sin(uTime * 2.4 + aSeed.x * 80.0);
  vColor = mix(vec3(0.3, 0.78, 1.0), vec3(0.9, 0.98, 1.0), near);
  vAlpha = ((0.12 + 0.88 * e) * twinkle + near * 3.5) * (1.0 - g);
  gl_PointSize = max(1.2, (0.045 + aSeed.z * 0.03) * uProjScale / -mv.z) * (1.0 + near);
}
`;

const fragment = glsl`
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vColor * (exp(-r * r * 5.0) * 0.8 + exp(-r * r * 30.0)) * vAlpha, 1.0);
}
`;

export function Title() {
  const [targets, setTargets] = useState<Float32Array | null>(null);
  const phase = useSea((s) => s.phase);

  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "serif";
    let cancelled = false;
    sampleWord("noctiluca", family).then((t) => {
      if (!cancelled) setTargets(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const built = useMemo(() => {
    if (!targets) return null;
    const count = targets.length / 2;
    const starts = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 16;
      starts[i * 3] = Math.cos(a) * r;
      starts[i * 3 + 1] = -6 - Math.random() * 14;
      starts[i * 3 + 2] = Math.sin(a) * r * 0.4;
      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 2));
    geometry.setAttribute("aStart", new THREE.BufferAttribute(starts, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: shared.uTime,
        uProjScale: shared.uProjScale,
        uSpread: shared.uSpread,
        uAspect: shared.uAspect,
        uPointer: shared.uPointer,
        uForm: { value: 0 },
        uGone: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, startedAt: now() };
  }, [targets]);

  useFrame((_, dt) => {
    if (!built) return;
    const u = built.material.uniforms;
    const formTime = motion.reducedMotion ? 0.01 : 3.2;
    u.uForm.value = Math.min(1, (now() - built.startedAt) / formTime);
    const goal = phase === "diving" ? 1 : 0;
    u.uGone.value += (goal - u.uGone.value) * (1 - Math.exp(-dt * (goal ? 0.7 : 2)));
  });

  if (!built) return null;
  return <points geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={5} />;
}
