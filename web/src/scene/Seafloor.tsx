"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { CHALLENGER_DEEP, worldY } from "@/lib/ocean";
import { DOT_FRAGMENT, LAMP, NOISE, glsl, shared } from "./shared";

// The bottom of the Challenger Deep: soft grey ooze, only visible where the
// lamp touches it.
const COLS = 220;
const ROWS = 110;
export const FLOOR_Y = worldY(CHALLENGER_DEEP) - 5.5;

const vertex = glsl`
uniform float uTime;
uniform float uProjScale;
attribute float aSeed;
varying vec3 vColor;
varying float vAlpha;
${NOISE}
${LAMP}
void main() {
  vec3 p = position;
  float h = fbm(p.xz * 0.08) * 3.2 + fbm(p.xz * 0.5 + 7.0) * 0.35;
  p.y += h - 1.2;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.5);
  float lamp = lampOn(gl_Position, dist);
  float fog = smoothstep(95.0, 15.0, dist);
  float speck = step(0.985, aSeed);
  vColor = mix(vec3(0.55, 0.6, 0.62), vec3(1.0, 0.88, 0.7), clamp(lamp, 0.0, 1.0)) * (0.012 + lamp * 1.1 + speck * lamp * 2.0) * fog;
  vAlpha = 1.0;
  gl_PointSize = max(1.0, (0.05 + aSeed * 0.05) * uProjScale / dist);
}
`;

export function Seafloor() {
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COLS * ROWS * 3);
    const seeds = new Float32Array(COLS * ROWS);
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const depth = Math.pow(r / (ROWS - 1), 1.35);
        positions[i * 3] = (c / (COLS - 1) - 0.5) * (40 + depth * 130) + (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = FLOOR_Y;
        positions[i * 3 + 2] = -6 - depth * 95 + (Math.random() - 0.5) * 0.6;
        seeds[i] = Math.random();
        i++;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: DOT_FRAGMENT,
      uniforms: {
        uTime: shared.uTime,
        uProjScale: shared.uProjScale,
        uPointer: shared.uPointer,
        uLamp: shared.uLamp,
        uAspect: shared.uAspect,
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.y - FLOOR_Y < 60;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
