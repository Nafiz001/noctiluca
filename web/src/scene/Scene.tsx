"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";

import { motion, now, step } from "@/lib/motion";
import { WORLD_DEPTH, clamp } from "@/lib/ocean";
import { Creatures } from "./creatures";
import { Divers } from "./Divers";
import { Lights } from "./Lights";
import { Plankton } from "./Plankton";
import { Seafloor } from "./Seafloor";
import { FOV, shared, stage } from "./shared";
import { Snow } from "./Snow";
import { Title } from "./Title";
import { Water } from "./Water";

// Moves the camera through the water and keeps the shared uniforms current.
function Rig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    step(dt);
    stage.camera = camera;

    const y = -motion.progress * WORLD_DEPTH;
    const sway = motion.reducedMotion ? 0 : 1;
    camera.position.x += (motion.pointer.x * 0.9 * sway - camera.position.x) * (1 - Math.exp(-dt * 1.5));
    camera.position.y = y + Math.sin(now() * 0.35) * 0.08 * sway;
    camera.position.z = 0;
    // Look down a little as the seafloor comes into view.
    const floor = clamp((motion.progress - 0.965) / 0.035, 0, 1);
    camera.rotation.set(-0.16 * floor * floor + motion.pointer.y * 0.02 * sway, -motion.pointer.x * 0.03 * sway, 0);

    const aspect = size.width / size.height;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    shared.uTime.value = now();
    shared.uPointer.value.set(motion.pointer.x, motion.pointer.y);
    shared.uAspect.value = aspect;
    shared.uProgress.value = motion.progress;
    shared.uCamY.value = camera.position.y;
    shared.uVelocity.value = motion.velocity * WORLD_DEPTH;
    shared.uProjScale.value = (size.height * dpr) / (2 * halfTan);
    shared.uSpread.value = halfTan * aspect;
    // The lamp comes on as the daylight fails.
    shared.uLamp.value = 0.25 + 0.75 * THREE.MathUtils.smoothstep(motion.depth, 60, 320);
  }, -1);

  return null;
}

export default function Scene() {
  return (
    <Canvas
      className="sea-canvas"
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, depth: false }}
      camera={{ fov: FOV, near: 0.1, far: 300, position: [0, 0, 0] }}
      flat
      onCreated={({ gl }) => {
        gl.setClearColor("#01060b");
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <Rig />
      <Water />
      <Snow />
      <Seafloor />
      <Creatures />
      <Divers />
      <Lights />
      <Title />
      <Plankton />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={1.25} luminanceThreshold={0.08} luminanceSmoothing={0.35} radius={0.78} levels={7} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Noise opacity={0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
        <Vignette offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
