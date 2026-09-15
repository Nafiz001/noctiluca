import * as THREE from "three";

// Uniform objects shared by every material in the sea. They're updated once
// per frame by the camera rig, and three.js reads the same objects everywhere.
export const shared = {
  uTime: { value: 0 },
  uPointer: { value: new THREE.Vector2(0, -0.2) },
  uLamp: { value: 0 },
  uAspect: { value: 1 },
  uProgress: { value: 0 },
  uCamY: { value: 0 },
  uVelocity: { value: 0 },
  // Pixels per world unit at distance 1 from the camera.
  uProjScale: { value: 600 },
  // tan(fov / 2) * aspect: half the visible width at distance 1.
  uSpread: { value: 1 },
};

export const FOV = 55;

// The live camera, for code outside the canvas that needs to project.
export const stage: { camera: THREE.Camera | null } = { camera: null };

export const glsl = String.raw;

export const NOISE = glsl`
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise21(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise21(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
mat2 rot2(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
`;

// How strongly the diver's lamp falls on a point, given its clip position and
// its distance from the camera. The lamp is a soft cone through the pointer.
export const LAMP = glsl`
uniform vec2 uPointer;
uniform float uLamp;
uniform float uAspect;
float lampOn(vec4 clip, float dist) {
  vec2 ndc = clip.xy / clip.w;
  vec2 d = (ndc - uPointer) * vec2(uAspect, 1.0);
  float cone = exp(-dot(d, d) * 7.0);
  float reach = exp(-max(dist - 8.0, 0.0) * 0.045);
  return cone * reach * uLamp;
}
`;

// A soft round point sprite with a hot centre.
export const DOT_FRAGMENT = glsl`
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv) * 2.0;
  if (r > 1.0) discard;
  float glow = exp(-r * r * 4.0);
  float core = exp(-r * r * 30.0);
  gl_FragColor = vec4(vColor * (glow * 0.7 + core * 0.9) * vAlpha, 1.0);
}
`;

export function linear(hex: string): THREE.Color {
  // THREE.Color parses sRGB hex and stores linear values under colour management.
  return new THREE.Color(hex);
}
