"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { motion, now } from "@/lib/motion";
import { sound } from "@/lib/sound";
import { worldY } from "@/lib/ocean";
import { useSea } from "@/lib/store";
import { DOT_FRAGMENT, LAMP, NOISE, glsl, shared } from "../shared";

// Every animal is a cloud of points. A creature supplies the shape (points
// with a few numbers each) and a vertex shader that moves and colours them;
// this module handles the rest: placement at its real depth, being found,
// and putting on its display when touched.

export type CreatureState = {
  slug: string;
  displayAt: number;
  // Where it is on screen, in CSS pixels, and roughly how big.
  screen: { x: number; y: number; r: number; visible: boolean };
  glows: boolean;
  hasDisplay: boolean;
  lookedAt: number;
};

export const creatures: Record<string, CreatureState> = {};

export function touchCreature(x: number, y: number): CreatureState | null {
  let best: CreatureState | null = null;
  let bestD = Infinity;
  for (const c of Object.values(creatures)) {
    if (!c.screen.visible) continue;
    const d = Math.hypot(c.screen.x - x, c.screen.y - y);
    if (d < c.screen.r && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  if (best) {
    if (best.hasDisplay && now() - best.displayAt > 2.5) {
      best.displayAt = now();
      sound.ping(best.slug === "stoplight-loosejaw" ? 700 : 470, 0.7);
    }
    useSea.getState().find(best.slug);
  }
  return best;
}

export const CREATURE_HEAD = glsl`
uniform float uTime;
uniform float uProjScale;
uniform vec3 uOrigin;
uniform float uScale;
uniform float uDisplay;
attribute vec4 aData;
attribute vec3 aExtra;
varying vec3 vColor;
varying float vAlpha;
${NOISE}
${LAMP}

float gDist;
// Project a world position as a point of the given world size; returns how
// much lamp light falls on it.
float place(vec3 world, float size) {
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gDist = max(-mv.z, 0.5);
  gl_PointSize = max(1.0, size * uProjScale / gDist);
  vAlpha = 1.0;
  return lampOn(gl_Position, gDist);
}
float displayEnvelope(float rise, float hold, float fall) {
  return smoothstep(0.0, rise, uDisplay) * (1.0 - smoothstep(hold, hold + fall, uDisplay));
}
`;

export type Shape = {
  positions: number[];
  data: number[];
  extra: number[];
};

export class ShapeBuilder implements Shape {
  positions: number[] = [];
  data: number[] = [];
  extra: number[] = [];

  add(p: [number, number, number], data: [number, number, number, number], extra: [number, number, number] = [0, 0, 0]) {
    this.positions.push(p[0], p[1], p[2]);
    this.data.push(data[0], data[1], data[2], data[3]);
    this.extra.push(extra[0], extra[1], extra[2]);
    return this;
  }
}

type Options = {
  slug: string;
  depth: number;
  x: number;
  z: number;
  scale?: number;
  radius: number; // world units, for touching and framing
  glows: boolean;
  hasDisplay: boolean;
  vertex: string;
  build: () => Shape;
  uniforms?: Record<string, THREE.IUniform>;
  // Moves the origin over time; called every frame.
  sway?: (t: number, origin: THREE.Vector3, state: CreatureState) => void;
  onFrame?: (t: number, origin: THREE.Vector3, state: CreatureState) => void;
};

export function useCreature(options: Options) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const { geometry, material, state, home } = useMemo(() => {
    const built = options.build();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(built.positions, 3));
    geometry.setAttribute("aData", new THREE.Float32BufferAttribute(built.data, 4));
    geometry.setAttribute("aExtra", new THREE.Float32BufferAttribute(built.extra, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader: CREATURE_HEAD + options.vertex,
      fragmentShader: DOT_FRAGMENT,
      uniforms: {
        uTime: shared.uTime,
        uProjScale: shared.uProjScale,
        uPointer: shared.uPointer,
        uLamp: shared.uLamp,
        uAspect: shared.uAspect,
        uOrigin: { value: new THREE.Vector3() },
        uScale: { value: options.scale ?? 1 },
        uDisplay: { value: 1000 },
        ...options.uniforms,
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const state: CreatureState = {
      slug: options.slug,
      displayAt: -1000,
      screen: { x: 0, y: 0, r: 0, visible: false },
      glows: options.glows,
      hasDisplay: options.hasDisplay,
      lookedAt: 0,
    };
    const home = new THREE.Vector3(options.x, worldY(options.depth), options.z);
    return { geometry, material, state, home };
    // Built once per creature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registered from an effect, so the registry always holds the state object
  // this component actually animates.
  useEffect(() => {
    creatures[options.slug] = state;
    return () => {
      if (creatures[options.slug] === state) delete creatures[options.slug];
    };
  }, [options.slug, state]);

  const scratch = useMemo(() => ({ v: new THREE.Vector3(), edge: new THREE.Vector3(), reach: new THREE.Vector3() }), []);

  useFrame((_, dt) => {
    const t = now();
    const origin = material.uniforms.uOrigin.value as THREE.Vector3;
    const onScreenBand = Math.abs(home.y - camera.position.y) < 40;
    // Keep the creature roughly in frame horizontally on narrow screens.
    const fit = Math.min(1, (shared.uSpread.value * -options.z * 0.8) / Math.max(Math.abs(options.x), 0.001));
    origin.set(options.x * fit, home.y, options.z);
    options.sway?.(t, origin, state);
    material.uniforms.uDisplay.value = t - state.displayAt;
    material.visible = onScreenBand;

    if (!onScreenBand) {
      state.screen.visible = false;
      state.lookedAt = 0;
      if (useSea.getState().foundCreature === options.slug) useSea.getState().find(null);
      return;
    }
    options.onFrame?.(t, origin, state);

    const v = scratch.v.copy(origin).project(camera);
    const sx = ((v.x + 1) / 2) * size.width;
    const sy = ((1 - v.y) / 2) * size.height;
    const reach = scratch.reach.set(options.radius * (options.scale ?? 1), 0, 0);
    const edge = scratch.edge.copy(origin).add(reach).project(camera);
    const r = Math.max(40, Math.abs(((edge.x + 1) / 2) * size.width - sx));
    const visible = v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.85;
    state.screen = { x: sx, y: sy, r, visible };

    // Being found: glowing animals just need to be in view for a moment;
    // the ones that make no light need the lamp pointed at them.
    const lampNear = Math.hypot((motion.pointer.x - v.x) * shared.uAspect.value, motion.pointer.y - v.y) < (r / size.height) * 2.2 + 0.08;
    const noticed = visible && (options.glows ? Math.abs(v.y) < 0.6 : lampNear && shared.uLamp.value > 0.3);
    state.lookedAt = noticed ? state.lookedAt + dt : Math.max(0, state.lookedAt - dt * 0.5);

    const sea = useSea.getState();
    if (sea.phase !== "diving") return;
    if (state.lookedAt > (options.glows ? 0.9 : 0.6) && sea.foundCreature !== options.slug) {
      const current = sea.foundCreature ? creatures[sea.foundCreature] : null;
      if (!current || !current.screen.visible) sea.find(options.slug);
    }
    if (sea.foundCreature === options.slug && !visible) sea.find(null);
  });

  return { geometry, material, state };
}

// Helpers for building shapes.
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const TAU = Math.PI * 2;
