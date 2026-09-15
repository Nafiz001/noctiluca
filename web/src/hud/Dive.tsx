"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";

import { api } from "@/lib/api";
import { diveTo, motion, now, nudge } from "@/lib/motion";
import { connectToSea } from "@/lib/socket";
import { useSea } from "@/lib/store";
import { Vector3 } from "three";

import { progressAt } from "@/lib/ocean";
import { creatures, touchCreature } from "@/scene/creatures/common";
import { lightPosition } from "@/scene/placement";
import { shared, stage } from "@/scene/shared";
import { Composer } from "./Composer";
import { Gauge } from "./Gauge";
import { Intro } from "./Intro";
import { LightCard } from "./LightCard";
import { Actions, CreatureCaption, HoverTip, Notice, Presence, SeafloorCard, SoundToggle } from "./Overlay";
import { Readouts } from "./Readouts";
import { ZoneTitle } from "./ZoneTitle";

const Scene = dynamic(() => import("@/scene/Scene"), { ssr: false });

export function Dive() {
  const phase = useSea((s) => s.phase);
  const begin = useSea((s) => s.begin);

  const start = useCallback(() => {
    if (useSea.getState().phase === "diving") return;
    begin();
    // Slip under the surface a little way on your own.
    if (motion.target < 0.02) diveTo(0.035);
  }, [begin]);

  // Load the sea, keep it fresh, and listen to it live.
  useEffect(() => {
    const sea = useSea.getState();
    const loadLights = () => api.lights().then(sea.setLights).catch(() => {});
    const loadStats = () => api.sea().then(sea.setStats).catch(() => {});
    api.creatures().then(sea.setCreatures).catch(() => sea.say("The sea isn't answering. Check that the backend is running."));
    loadLights();
    loadStats();
    const lightsTimer = setInterval(loadLights, 90_000);
    const statsTimer = setInterval(loadStats, 30_000);
    const disconnect = connectToSea();
    if (process.env.NODE_ENV === "development") {
      // A handle for poking at the sea from the console while developing.
      const screenOf = (id: string) => {
        const light = useSea.getState().lights[id];
        if (!light || !stage.camera) return null;
        const v = lightPosition(light, now(), shared.uSpread.value, new Vector3()).project(stage.camera);
        return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
      };
      (window as unknown as Record<string, unknown>).__sea = { motion, diveTo, progressAt, store: useSea, creatures, screenOf };
    }
    return () => {
      clearInterval(lightsTimer);
      clearInterval(statsTimer);
      disconnect();
    };
  }, []);

  // Input: the wheel, touch and keys move you through the water; the pointer
  // is the lamp.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.reducedMotion = media.matches;
    const onMedia = () => (motion.reducedMotion = media.matches);
    media.addEventListener("change", onMedia);

    const blocked = () => {
      const s = useSea.getState();
      return s.composerOpen;
    };

    const onWheel = (e: WheelEvent) => {
      if (blocked() || (e.target as HTMLElement).closest?.(".light-card, .composer")) return;
      const lines = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? window.innerHeight : 1;
      const amount = (e.deltaY * lines) / 100;
      if (useSea.getState().phase === "surface") {
        if (amount > 0) start();
        return;
      }
      nudge(amount * 0.0045);
    };

    const setPointer = (clientX: number, clientY: number) => {
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = -(clientY / window.innerHeight) * 2 + 1;
      motion.pointerSpeed += Math.hypot(x - motion.pointer.x, y - motion.pointer.y);
      motion.pointer.x = x;
      motion.pointer.y = y;
    };

    let touchY: number | null = null;
    const onPointerMove = (e: PointerEvent) => {
      setPointer(e.clientX, e.clientY);
      if (e.pointerType === "touch" && touchY !== null && !blocked()) {
        const dy = touchY - e.clientY;
        touchY = e.clientY;
        if (useSea.getState().phase === "diving") nudge(dy * 0.00022);
      }
    };

    let downAt = { x: 0, y: 0, t: 0 };
    const onPointerDown = (e: PointerEvent) => {
      setPointer(e.clientX, e.clientY);
      const onCanvas = (e.target as HTMLElement).tagName === "CANVAS";
      if (e.pointerType === "touch" && onCanvas) touchY = e.clientY;
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    };

    const onPointerUp = (e: PointerEvent) => {
      touchY = null;
      const onCanvas = (e.target as HTMLElement).tagName === "CANVAS";
      const tap = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && performance.now() - downAt.t < 500;
      if (!onCanvas || !tap) return;
      const { clientX, clientY } = e;
      const act = () => {
        const sea = useSea.getState();
        if (sea.phase !== "diving") return;
        if (sea.composerOpen) {
          sea.openComposer(false);
          return;
        }
        if (sea.hoveredId) {
          sea.select(sea.hoveredId);
          return;
        }
        if (touchCreature(clientX, clientY)) return;
        sea.select(null);
      };
      // A mouse has been hovering, so the light under it is already known. A
      // finger has only just landed; let the scene pick for a frame first.
      if (e.pointerType === "mouse") act();
      else requestAnimationFrame(() => requestAnimationFrame(act));
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [role=slider]")) return;
      const sea = useSea.getState();
      if (e.key === "Escape") {
        sea.select(null);
        sea.openComposer(false);
        return;
      }
      const moves: Record<string, number> = {
        ArrowDown: 0.008,
        ArrowUp: -0.008,
        PageDown: 0.05,
        PageUp: -0.05,
        " ": 0.03,
      };
      if (e.key in moves || e.key === "Home" || e.key === "End") {
        if (target.closest("button") && (e.key === " " || e.key === "Enter")) return;
        e.preventDefault();
        if (sea.phase === "surface") {
          if (e.key !== "ArrowUp" && e.key !== "PageUp" && e.key !== "Home") start();
          return;
        }
        if (e.key === "Home") diveTo(0);
        else if (e.key === "End") diveTo(1);
        else nudge(moves[e.key]);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKey);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [start]);

  // The pointer turns into a hand over things you can touch.
  const hovered = useSea((s) => Boolean(s.hoveredId));
  useEffect(() => {
    document.body.dataset.pointing = hovered ? "true" : "false";
  }, [hovered]);

  return (
    <main className={`dive dive-${phase}`}>
      <Scene />
      {phase === "surface" ? (
        <Intro onBegin={start} />
      ) : (
        <>
          <header className="topbar">
            <button className="wordmark" onClick={() => diveTo(0)} aria-label="noctiluca, return to the surface">
              noctiluca
            </button>
            <div className="topbar-end">
              <SoundToggle />
              <Presence />
            </div>
          </header>
          <Gauge />
          <ZoneTitle />
          <Readouts />
          <CreatureCaption />
          <LightCard />
          <Composer />
          <SeafloorCard />
          <Actions />
          <HoverTip />
          <Notice />
        </>
      )}
      {phase === "surface" && <Notice />}
    </main>
  );
}
