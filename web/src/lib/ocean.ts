// The water column, from the surface to the bottom of the Challenger Deep.
//
// Real depths are wildly uneven — the sunlight zone is 200 m, the hadal zone
// nearly 5 km — so the dive doesn't move through metres at a constant rate.
// Each zone gets a share of "progress" (0 at the surface, 1 at the bottom),
// and the world is laid out in progress, not metres.

export const CHALLENGER_DEEP = 10_935;

// World units from the surface to the seafloor.
export const WORLD_DEPTH = 560;

export type ZoneKey = "sunlight" | "twilight" | "midnight" | "abyssal" | "hadal";

export type Zone = {
  key: ZoneKey;
  name: string;
  top: number;
  bottom: number;
  share: number;
  line: string;
};

export const ZONES: Zone[] = [
  {
    key: "sunlight",
    name: "Sunlight zone",
    top: 0,
    bottom: 200,
    share: 0.1,
    line: "By day, enough light for plants to grow. It is night now, and the plankton are awake.",
  },
  {
    key: "twilight",
    name: "Twilight zone",
    top: 200,
    bottom: 1000,
    share: 0.3,
    line: "The last blue of daylight fades out here. Three in four animals in the open deep make their own light.",
  },
  {
    key: "midnight",
    name: "Midnight zone",
    top: 1000,
    bottom: 4000,
    share: 0.3,
    line: "No sunlight has ever reached this far. The only light is the light animals make.",
  },
  {
    key: "abyssal",
    name: "Abyssal zone",
    top: 4000,
    bottom: 6000,
    share: 0.12,
    line: "Barely above freezing, under hundreds of times the pressure at the surface. Fewer animals glow here.",
  },
  {
    key: "hadal",
    name: "Hadal zone",
    top: 6000,
    bottom: CHALLENGER_DEEP,
    share: 0.18,
    line: "Named for Hades. Only the ocean trenches go this deep. Your lamp is the only light for kilometres.",
  },
];

const starts = (() => {
  let acc = 0;
  return ZONES.map((zone) => {
    const start = acc;
    acc += zone.share;
    return start;
  });
})();

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function progressAt(depth: number): number {
  const d = clamp(depth, 0, CHALLENGER_DEEP);
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    if (d <= z.bottom || i === ZONES.length - 1) {
      return starts[i] + ((d - z.top) / (z.bottom - z.top)) * z.share;
    }
  }
  return 1;
}

export function depthAt(progress: number): number {
  const p = clamp(progress, 0, 1);
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    if (p <= starts[i] + z.share || i === ZONES.length - 1) {
      return z.top + ((p - starts[i]) / z.share) * (z.bottom - z.top);
    }
  }
  return CHALLENGER_DEEP;
}

export const worldY = (depth: number) => -progressAt(depth) * WORLD_DEPTH;
export const depthAtWorldY = (y: number) => depthAt(-y / WORLD_DEPTH);

export function zoneAt(depth: number): Zone {
  return ZONES.find((z) => depth < z.bottom) ?? ZONES[ZONES.length - 1];
}

export const zoneStart = (zone: Zone) => starts[ZONES.indexOf(zone)];

// A tropical western-Pacific profile: a warm surface, a steep thermocline, a
// cold deep, and a slight rise in the trench from adiabatic compression.
export function temperatureAt(depth: number): number {
  const t = 1.5 + 18 * Math.exp(-depth / 150) + 9 * Math.exp(-depth / 900);
  return depth > 4000 ? t + 0.00012 * (depth - 4000) : t;
}

export function pressureBarAt(depth: number): number {
  return 1.013 + depth * 0.0993;
}

// Fraction of surface daylight left: 1% at 200 m in clear open ocean.
export function daylightExponentAt(depth: number): number {
  return -depth / (43.43 * Math.LN10);
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

export function formatDaylight(depth: number): string {
  const exponent = daylightExponentAt(depth);
  const fraction = Math.pow(10, exponent);
  if (fraction >= 0.1) return `${Math.round(fraction * 100)}%`;
  if (fraction >= 0.001) return `${(fraction * 100).toFixed(1)}%`;
  const power = String(Math.round(exponent)).replace(/./g, (c) => SUPERSCRIPT[c] ?? c);
  return `10${power}`;
}

const metres = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatDepth = (depth: number) => `${metres.format(Math.round(depth))} m`;
