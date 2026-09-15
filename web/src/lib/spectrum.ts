// Colours of light, by wavelength.

export type RGB = [number, number, number];

// sRGB (0..1) for a visible wavelength, after Dan Bruton's approximation.
// The usual dimming toward the ends of the spectrum is left out: a red light in
// the sea should still read as a light.
export function wavelengthToRGB(nm: number): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else {
    r = 1;
  }
  // Soften toward white a touch, the way bright light blooms in water.
  const lift = 0.05;
  return [r * (1 - lift) + lift, g * (1 - lift) + lift, b * (1 - lift) + lift];
}

export function wavelengthCss(nm: number, alpha = 1): string {
  const [r, g, b] = wavelengthToRGB(nm).map((c) => Math.round(c * 255));
  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

// sRGB -> linear, for feeding shaders.
export function toLinear([r, g, b]: RGB): RGB {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [f(r), f(g), f(b)];
}

export const WAVELENGTH_MIN = 440;
export const WAVELENGTH_MAX = 710;

// What a colour means down here.
const NOTES: Array<[number, string]> = [
  [455, "Deep blue, a little shorter than most animal light. Clear open ocean lets it through easily."],
  [490, "Blue, the colour most sea creatures make, because it carries furthest through seawater."],
  [530, "Green, like the glowing protein of the crystal jelly, Aequorea victoria."],
  [590, "Yellow. Fireflies glow near here, but almost nothing in the open sea does."],
  [660, "Orange. Water swallows it within a few metres."],
  [711, "Red, like the searchlight of the stoplight loosejaw. Almost nothing down here can see it."],
];

export function wavelengthNote(nm: number): string {
  return (NOTES.find(([limit]) => nm < limit) ?? NOTES[NOTES.length - 1])[1];
}
