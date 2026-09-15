"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { DOT_FRAGMENT, LAMP, glsl, shared } from "./shared";

// Marine snow: flakes of dead plankton, dust and mucus that sink forever. It's
// what makes still water feel like it's moving past you as you dive.
const COUNT = 2600;
const SPAN = 70;

const vertex = glsl`
uniform float uTime;
uniform float uCamY;
uniform float uVelocity;
uniform float uProjScale;
uniform float uSpread;
uniform float uProgress;
attribute float aSeed;
varying vec3 vColor;
varying float vAlpha;
${LAMP}

void main() {
  float z = position.z;
  float dist = -z;
  float sink = uTime * (0.08 + aSeed * 0.12);
  float y = position.y * ${SPAN.toFixed(1)} - sink;
  float rel = mod(y - uCamY + ${(SPAN / 2).toFixed(1)}, ${SPAN.toFixed(1)}) - ${(SPAN / 2).toFixed(1)};
  float x = position.x * uSpread * dist * 1.15 + sin(uTime * 0.17 + aSeed * 40.0) * 0.4;
  vec3 world = vec3(x, uCamY + rel, z);

  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;

  float lamp = lampOn(gl_Position, dist);
  float moon = (1.0 - smoothstep(0.0, 0.12, uProgress)) * 0.35;
  float ambient = 0.05 + moon;
  float streak = 1.0 + min(abs(uVelocity) * 0.35, 5.0);

  vColor = mix(vec3(0.55, 0.72, 0.8), vec3(1.0, 0.86, 0.66), clamp(lamp * 1.5, 0.0, 1.0));
  vAlpha = (ambient + lamp * 2.4) * (0.35 + aSeed * 0.65) * smoothstep(90.0, 20.0, dist);
  gl_PointSize = max(1.2, (0.05 + aSeed * 0.07) * uProjScale / dist) * mix(1.0, streak, 0.5);
}
`;

export function Snow() {
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = Math.random() * 2 - 1;
      positions[i * 3 + 1] = Math.random();
      positions[i * 3 + 2] = -(4 + Math.pow(Math.random(), 0.8) * 70);
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: DOT_FRAGMENT,
      uniforms: {
        uTime: shared.uTime,
        uCamY: shared.uCamY,
        uVelocity: shared.uVelocity,
        uProjScale: shared.uProjScale,
        uSpread: shared.uSpread,
        uProgress: shared.uProgress,
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

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
