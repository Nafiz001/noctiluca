"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { motion, now } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { worldY } from "@/lib/ocean";
import { toLinear, wavelengthToRGB } from "@/lib/spectrum";
import { MAX_LIGHTS, useSea } from "@/lib/store";
import { sparkle } from "./Plankton";
import { lightPosition, lightZ } from "./placement";
import { glsl, shared } from "./shared";

// The lights people left. Each is a camera-facing quad drawn with instancing;
// its glow, flicker, birth and the ring it throws when answered are all
// computed in the shader from a handful of per-light numbers.
const vertex = glsl`
uniform float uTime;
uniform float uSpread;
uniform float uHover;
uniform float uSelected;
attribute vec3 aPlace;   // drift, world y, z
attribute vec3 aColor;
attribute vec4 aState;   // energy, phase, born, flare
attribute vec2 aSlot;    // slot, visible
varying vec2 vUv;
varying vec3 vColor;
varying float vEnergy;
varying float vFlare;
varying float vBirth;
varying float vFocus;
varying float vPhase;

void main() {
  if (aSlot.y < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float z = aPlace.z;
  float phase = aState.y;
  vec3 center = vec3(
    aPlace.x * uSpread * -z * 0.82 + sin(uTime * 0.13 + phase * 40.0) * 0.35,
    aPlace.y + sin(uTime * 0.21 + phase * 17.0) * 0.45,
    z
  );

  float energy = aState.x;
  float birth = clamp((uTime - aState.z) / 2.4, 0.0, 1.0);
  float flare = uTime - aState.w;
  float hovered = 1.0 - step(0.5, abs(aSlot.x - uHover));
  float selected = 1.0 - step(0.5, abs(aSlot.x - uSelected));

  float grow = birth < 1.0 ? (1.0 - pow(1.0 - birth, 3.0)) * (1.0 + sin(birth * 3.1416) * 0.6) : 1.0;
  float size = mix(2.2, 4.2, clamp(sqrt(energy / 2.0), 0.0, 1.0)) * grow;
  size *= 1.0 + hovered * 0.25 + selected * 0.35;
  size *= 1.0 + 1.6 * step(0.0, flare) * (1.0 - smoothstep(0.0, 3.0, flare));

  vec4 mv = viewMatrix * vec4(center, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;

  vUv = uv;
  vColor = aColor;
  vEnergy = energy;
  vFlare = flare;
  vBirth = birth;
  vFocus = max(hovered * 0.6, selected);
  vPhase = phase;
}
`;

const fragment = glsl`
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying float vEnergy;
varying float vFlare;
varying float vBirth;
varying float vFocus;
varying float vPhase;

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;

  float strength = 0.45 + 0.55 * clamp(sqrt(vEnergy), 0.0, 1.6);
  float flicker = 0.86 + 0.14 * sin(uTime * 1.7 + vPhase * 30.0) * sin(uTime * 0.63 + vPhase * 11.0);
  float flareFade = step(0.0, vFlare) * exp(-vFlare * 1.1);
  float birthFlash = (1.0 - vBirth) * step(0.001, vBirth);

  float core = exp(-r * r * 900.0) * 1.1;
  float glow = exp(-r * 14.0) * 1.5;
  float halo = exp(-r * 4.5) * 0.2;

  // When answered, a ring of light runs outward.
  float ringR = clamp(vFlare * 0.45, 0.0, 0.95);
  float ring = exp(-pow((r - ringR) * 16.0, 2.0)) * flareFade * 1.6;

  // A lantern-coloured circle marks the light you're looking at.
  float dash = step(0.0, sin(atan(p.y, p.x) * 18.0 + uTime * 0.8));
  float focusRing = exp(-pow((r - 0.42) * 60.0, 2.0)) * vFocus * (0.35 + dash * 0.5);

  vec3 col = vColor * (glow + halo + ring) * strength * flicker * (1.0 + flareFade * 1.5 + birthFlash * 2.0);
  col += mix(vColor, vec3(1.0), 0.55) * core * strength * (1.0 + flareFade * 2.0);
  col += vec3(1.0, 0.78, 0.5) * focusRing;
  gl_FragColor = vec4(col, 1.0);
}
`;

const PICK_RADIUS_PX = 34;

export function Lights() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const { geometry, material, attrs } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.getAttribute("position"));
    geometry.setAttribute("uv", quad.getAttribute("uv"));
    const place = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LIGHTS * 3), 3);
    const color = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LIGHTS * 3), 3);
    const state = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LIGHTS * 4), 4);
    const slot = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LIGHTS * 2), 2);
    for (const a of [place, color, state, slot]) a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aPlace", place);
    geometry.setAttribute("aColor", color);
    geometry.setAttribute("aState", state);
    geometry.setAttribute("aSlot", slot);
    geometry.instanceCount = MAX_LIGHTS;

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: shared.uTime,
        uSpread: shared.uSpread,
        uHover: { value: -1 },
        uSelected: { value: -1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, attrs: { place, color, state, slot } };
  }, []);

  // Mirror the store into the instance buffers whenever lights change.
  const sparkled = useRef(new Set<string>());
  useEffect(() => {
    const write = (state: ReturnType<typeof useSea.getState>) => {
      const { place, color, state: st, slot } = attrs;
      for (let i = 0; i < MAX_LIGHTS; i++) slot.setY(i, 0);
      const t = now();
      for (const light of Object.values(state.lights)) {
        const i = light.slot;
        const [r, g, b] = toLinear(wavelengthToRGB(light.wavelength));
        place.setXYZ(i, light.drift, worldY(light.depth), lightZ(light.phase));
        color.setXYZ(i, r, g, b);
        st.setXYZW(i, light.energy, light.phase, light.bornAt, light.flareAt);
        slot.setXY(i, i, 1);

        // Newly born or freshly answered lights disturb the plankton around them.
        const key = `${light.id}:${light.bornAt}:${light.flareAt}`;
        const recent = Math.max(light.bornAt, light.flareAt);
        if (t - recent < 1 && !sparkled.current.has(key)) {
          sparkled.current.add(key);
          const at = lightPosition(light, t, shared.uSpread.value, new THREE.Vector3());
          const answered = light.flareAt > light.bornAt;
          sound.ping(light.wavelength, answered ? 0.8 : 1);
          sparkle(at, answered ? 70 : 140, {
            spread: 0.8,
            speed: 2.2,
            life: 2.4,
            color: toLinear(wavelengthToRGB(light.wavelength)),
          });
        }
      }
      for (const a of [place, color, st, slot]) a.needsUpdate = true;
    };
    write(useSea.getState());
    return useSea.subscribe((state, previous) => {
      if (state.lightsVersion !== previous.lightsVersion) write(state);
      const lights = state.lights;
      material.uniforms.uHover.value = state.hoveredId ? (lights[state.hoveredId]?.slot ?? -1) : -1;
      material.uniforms.uSelected.value = state.selectedId ? (lights[state.selectedId]?.slot ?? -1) : -1;
    });
  }, [attrs, material]);

  // Hover picking in screen space: nearest light to the pointer, if close.
  const scratch = useMemo(() => ({ v: new THREE.Vector3() }), []);
  useFrame(() => {
    const sea = useSea.getState();
    if (sea.phase !== "diving" || sea.composerOpen) {
      if (sea.hoveredId) sea.hover(null);
      return;
    }
    const t = now();
    const camY = camera.position.y;
    const px = ((motion.pointer.x + 1) / 2) * size.width;
    const py = ((1 - motion.pointer.y) / 2) * size.height;
    let best: string | null = null;
    let bestDistance = PICK_RADIUS_PX;
    for (const light of Object.values(sea.lights)) {
      const y = worldY(light.depth);
      if (Math.abs(y - camY) > 24) continue;
      const v = lightPosition(light, t, shared.uSpread.value, scratch.v).project(camera);
      if (v.z > 1) continue;
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestDistance) {
        bestDistance = d;
        best = light.id;
      }
    }
    sea.hover(best);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}
