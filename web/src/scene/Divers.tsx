"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import { useSea } from "@/lib/store";
import { diverPosition } from "./placement";
import { glsl, shared } from "./shared";

// Other people diving right now. Their lamps are warm, unlike anything alive
// down here, with the double blink of a submersible's strobe.
const MAX_DIVERS = 128;

const vertex = glsl`
uniform float uTime;
uniform float uProjScale;
attribute vec2 aDiver; // seed, visible
varying float vBlink;
varying float vVisible;
void main() {
  vVisible = aDiver.y;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float cycle = mod(uTime + aDiver.x * 3.0, 3.2);
  vBlink = exp(-pow((cycle - 0.1) * 18.0, 2.0)) + exp(-pow((cycle - 0.34) * 18.0, 2.0));
  gl_PointSize = aDiver.y * max(10.0, 2.6 * uProjScale / -mv.z);
}
`;

const fragment = glsl`
varying float vBlink;
varying float vVisible;
void main() {
  if (vVisible < 0.5) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv) * 2.0;
  if (r > 1.0) discard;
  float core = exp(-r * r * 180.0) * 2.4;
  float glow = exp(-r * 9.0) * 0.8;
  // A faint beam falling from the lamp.
  float beam = exp(-abs(uv.x) * 38.0 / max(uv.y + 0.5, 0.05)) * smoothstep(-0.05, 0.5, uv.y) * 0.25;
  vec3 warm = vec3(1.0, 0.72, 0.42);
  vec3 col = warm * (glow + beam) + vec3(1.0, 0.95, 0.85) * core + vec3(1.0) * vBlink * exp(-r * 6.0) * 1.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

function seedOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h / 9973;
}

export function Divers() {
  const { geometry, material, attrs } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(MAX_DIVERS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const diver = new THREE.BufferAttribute(new Float32Array(MAX_DIVERS * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("aDiver", diver);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: shared.uTime, uProjScale: shared.uProjScale },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, attrs: { position, diver } };
  }, []);

  // Divers glide toward their last reported position instead of jumping.
  const smooth = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const divers = Object.values(useSea.getState().divers).slice(0, MAX_DIVERS);
    const ease = 1 - Math.exp(-dt * 3);
    const live = new Set<string>();
    divers.forEach((d, i) => {
      live.add(d.id);
      diverPosition(d, shared.uSpread.value, target);
      let p = smooth.get(d.id);
      if (!p) {
        p = target.clone();
        smooth.set(d.id, p);
      }
      p.lerp(target, ease);
      attrs.position.setXYZ(i, p.x, p.y, p.z);
      attrs.diver.setXY(i, seedOf(d.id), 1);
    });
    for (let i = divers.length; i < MAX_DIVERS; i++) attrs.diver.setY(i, 0);
    for (const id of smooth.keys()) if (!live.has(id)) smooth.delete(id);
    attrs.position.needsUpdate = true;
    attrs.diver.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={9} />;
}
