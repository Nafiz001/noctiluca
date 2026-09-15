"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { NOISE, glsl, shared } from "./shared";

// The water itself: a full-screen gradient that darkens with depth, moonlight
// breaking through the surface when you're near it, and the warm haze of the
// diver's lamp in the water.
const vertex = glsl`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const fragment = glsl`
uniform float uTime;
uniform float uProgress;
uniform float uAspect;
uniform float uLamp;
uniform vec2 uPointer;
varying vec2 vUv;
${NOISE}

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

// Water colour at the top and bottom of the screen, by dive progress.
void waterAt(float p, out vec3 top, out vec3 bottom) {
  vec3 t0 = srgb(vec3(0.106, 0.353, 0.447)); vec3 b0 = srgb(vec3(0.039, 0.184, 0.251));
  vec3 t1 = srgb(vec3(0.028, 0.141, 0.212)); vec3 b1 = srgb(vec3(0.016, 0.090, 0.165));
  vec3 t2 = srgb(vec3(0.012, 0.067, 0.122)); vec3 b2 = srgb(vec3(0.008, 0.043, 0.086));
  vec3 t3 = srgb(vec3(0.006, 0.030, 0.062)); vec3 b3 = srgb(vec3(0.004, 0.022, 0.047));
  vec3 t4 = srgb(vec3(0.004, 0.016, 0.036)); vec3 b4 = srgb(vec3(0.002, 0.010, 0.026));
  vec3 t5 = srgb(vec3(0.002, 0.008, 0.020)); vec3 b5 = srgb(vec3(0.001, 0.005, 0.014));
  float s1 = smoothstep(0.0, 0.1, p);
  float s2 = smoothstep(0.1, 0.25, p);
  float s3 = smoothstep(0.25, 0.4, p);
  float s4 = smoothstep(0.4, 0.7, p);
  float s5 = smoothstep(0.7, 1.0, p);
  top = mix(mix(mix(mix(mix(t0, t1, s1), t2, s2), t3, s3), t4, s4), t5, s5);
  bottom = mix(mix(mix(mix(mix(b0, b1, s1), b2, s2), b3, s3), b4, s4), b5, s5);
}

void main() {
  vec2 uv = vUv;
  vec3 top; vec3 bottom;
  waterAt(uProgress, top, bottom);
  vec3 col = mix(bottom, top, smoothstep(0.0, 1.0, uv.y));

  // Moonlight through the surface: rays fanning down from above the screen.
  float surface = 1.0 - smoothstep(0.0, 0.085, uProgress);
  if (surface > 0.0) {
    vec2 q = vec2((uv.x - 0.5) * uAspect, 1.35 - uv.y);
    float angle = atan(q.x, q.y);
    float rays = fbm(vec2(angle * 7.0, uTime * 0.06)) * fbm(vec2(angle * 17.0 + 3.0, uTime * 0.11 + 5.0));
    rays = pow(rays * 2.2, 3.0);
    float fall = smoothstep(0.0, 1.0, uv.y) * exp(-abs(q.x) * 0.9);
    col += srgb(vec3(0.55, 0.78, 0.86)) * rays * fall * 0.16 * surface;

    // The underside of the surface, rippling.
    vec2 w = vec2(uv.x * uAspect * 3.0, uv.y * 8.0);
    float ripple = fbm(w + vec2(uTime * 0.15, -uTime * 0.05)) - fbm(w * 1.7 - vec2(uTime * 0.1, 0.0));
    float window = smoothstep(0.72, 1.0, uv.y) * (0.6 + ripple * 0.8);
    float moon = exp(-length(vec2((uv.x - 0.62) * uAspect * 2.2, (1.0 - uv.y) * 5.0)) * 2.4);
    col += srgb(vec3(0.62, 0.85, 0.92)) * (window * 0.05 + moon * (0.22 + ripple * 0.18)) * surface;
  }

  // The lamp's warm haze.
  vec2 d = (uv * 2.0 - 1.0 - uPointer) * vec2(uAspect, 1.0);
  float haze = exp(-dot(d, d) * 4.5);
  col += srgb(vec3(1.0, 0.84, 0.62)) * haze * uLamp * 0.014;

  // Break up banding in the long dark gradients.
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) / 400.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export function Water() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: shared.uTime,
          uProgress: shared.uProgress,
          uAspect: shared.uAspect,
          uLamp: shared.uLamp,
          uPointer: shared.uPointer,
        },
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
