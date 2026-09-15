import { create } from "zustand";

import type { Creature, Light, LightSummary, SeaStats } from "./api";
import { now } from "./motion";

export type LiveLight = Light & {
  slot: number;
  bornAt: number;
  flareAt: number;
};

export type OtherDiver = { id: string; depth: number; x: number; seenAt: number };

export const MAX_LIGHTS = 1024;

type Sea = {
  phase: "surface" | "diving";
  lights: Record<string, LiveLight>;
  lightsVersion: number;
  creatures: Creature[];
  divers: Record<string, OtherDiver>;
  stats: SeaStats | null;
  connected: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  composerOpen: boolean;
  foundCreature: string | null;
  notice: { text: string; at: number } | null;

  begin: () => void;
  say: (text: string) => void;
  setLights: (lights: Light[]) => void;
  addLight: (light: Light, bornAt?: number) => void;
  updateLight: (summary: Partial<Light> & Pick<LightSummary, "id">, flare?: boolean) => void;
  removeLight: (id: string) => void;
  setCreatures: (creatures: Creature[]) => void;
  setStats: (stats: SeaStats) => void;
  setConnected: (connected: boolean) => void;
  setDivers: (divers: Array<{ id: string; depth: number; x: number }>) => void;
  moveDiver: (diver: { id: string; depth: number; x: number }) => void;
  removeDiver: (id: string) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  openComposer: (open: boolean) => void;
  find: (slug: string | null) => void;
};

function freeSlot(lights: Record<string, LiveLight>): number {
  const used = new Set(Object.values(lights).map((l) => l.slot));
  for (let i = 0; i < MAX_LIGHTS; i++) if (!used.has(i)) return i;
  return -1;
}

export const useSea = create<Sea>((set, get) => ({
  phase: "surface",
  lights: {},
  lightsVersion: 0,
  creatures: [],
  divers: {},
  stats: null,
  connected: false,
  selectedId: null,
  hoveredId: null,
  composerOpen: false,
  foundCreature: null,
  notice: null,

  begin: () => set({ phase: "diving" }),
  say: (text) => set({ notice: { text, at: Date.now() } }),

  setLights: (incoming) =>
    set((state) => {
      const lights: Record<string, LiveLight> = {};
      incoming.slice(0, MAX_LIGHTS).forEach((light, slot) => {
        const previous = state.lights[light.id];
        lights[light.id] = { ...light, slot, bornAt: previous?.bornAt ?? -100, flareAt: previous?.flareAt ?? -100 };
      });
      return { lights, lightsVersion: state.lightsVersion + 1 };
    }),

  addLight: (light, bornAt = now()) =>
    set((state) => {
      const existing = state.lights[light.id];
      if (existing) {
        return {
          lights: { ...state.lights, [light.id]: { ...existing, ...light, yours: existing.yours || light.yours } },
          lightsVersion: state.lightsVersion + 1,
        };
      }
      const slot = freeSlot(state.lights);
      if (slot < 0) return state;
      return {
        lights: { ...state.lights, [light.id]: { ...light, slot, bornAt, flareAt: -100 } },
        lightsVersion: state.lightsVersion + 1,
        stats: state.stats && { ...state.stats, glowing: state.stats.glowing + 1, released: state.stats.released + 1 },
      };
    }),

  updateLight: (summary, flare = false) =>
    set((state) => {
      const existing = state.lights[summary.id];
      if (!existing) return state;
      const answeredMore = summary.answers !== undefined && summary.answers > existing.answers;
      return {
        lights: {
          ...state.lights,
          [summary.id]: { ...existing, ...summary, flareAt: flare || answeredMore ? now() : existing.flareAt },
        },
        lightsVersion: state.lightsVersion + 1,
      };
    }),

  removeLight: (id) =>
    set((state) => {
      if (!state.lights[id]) return state;
      const lights = { ...state.lights };
      delete lights[id];
      return {
        lights,
        lightsVersion: state.lightsVersion + 1,
        selectedId: state.selectedId === id ? null : state.selectedId,
        hoveredId: state.hoveredId === id ? null : state.hoveredId,
      };
    }),

  setCreatures: (creatures) => set({ creatures }),
  setStats: (stats) => set({ stats }),
  setConnected: (connected) => set({ connected }),

  setDivers: (divers) =>
    set(() => {
      const t = now();
      return { divers: Object.fromEntries(divers.map((d) => [d.id, { ...d, seenAt: t }])) };
    }),
  moveDiver: (diver) => set((state) => ({ divers: { ...state.divers, [diver.id]: { ...diver, seenAt: now() } } })),
  removeDiver: (id) =>
    set((state) => {
      const divers = { ...state.divers };
      delete divers[id];
      return { divers };
    }),

  select: (id) => {
    if (get().selectedId !== id) set({ selectedId: id, composerOpen: false });
  },
  hover: (id) => {
    if (get().hoveredId !== id) set({ hoveredId: id });
  },
  openComposer: (open) => set({ composerOpen: open, selectedId: open ? null : get().selectedId }),
  find: (slug) => {
    if (get().foundCreature !== slug) set({ foundCreature: slug });
  },
}));
