/**
 * Deterministic 2D value-noise + FBM utilities.
 * Same seed + coords → same value on every client.
 */

function hash3(seed: number, x: number, y: number): number {
  let h =
    (Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(seed | 0, 0x27d4eb2d)) >>>
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth value noise in [0, 1). */
export function valueNoise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const n00 = hash3(seed, x0, y0);
  const n10 = hash3(seed, x0 + 1, y0);
  const n01 = hash3(seed, x0, y0 + 1);
  const n11 = hash3(seed, x0 + 1, y0 + 1);
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

/** Fractal Brownian motion — returns roughly [0, 1). */
export function fbm2D(
  seed: number,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(seed + i * 1013, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridge noise in [0, 1) — mountain spines / river valleys. */
export function ridge2D(
  seed: number,
  x: number,
  y: number,
  octaves = 3
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(seed + i * 1723, x * freq, y * freq);
    const ridge = 1 - Math.abs(n * 2 - 1);
    sum += amp * ridge * ridge;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Domain-warped FBM — more organic, coastline-like shapes. */
export function warpedFbm2D(
  seed: number,
  x: number,
  y: number,
  octaves = 5,
  warpStrength = 0.65
): number {
  const wx =
    x +
    (fbm2D(seed ^ 0x11a1, x * 0.55, y * 0.55, 3) - 0.5) * 2 * warpStrength;
  const wy =
    y +
    (fbm2D(seed ^ 0x22b2, x * 0.55, y * 0.55, 3) - 0.5) * 2 * warpStrength;
  return fbm2D(seed, wx, wy, octaves);
}

/** Billowy noise (abs of fbm-ish) for dunes / badlands. */
export function billow2D(
  seed: number,
  x: number,
  y: number,
  octaves = 4
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = Math.abs(valueNoise2D(seed + i * 2081, x * freq, y * freq) * 2 - 1);
    sum += amp * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
