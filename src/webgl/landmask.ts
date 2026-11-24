/**
 * Deterministic procedural land field.
 * 3D value-noise fBm sampled on the unit sphere, so there is no seam at ±180°.
 * No textures, no external data.
 */

const fade = (t: number) => t * t * (3 - 2 * t);

function hash3(xi: number, yi: number, zi: number): number {
  let h = Math.imul(xi, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  let h2 = Math.imul(yi, 668265263);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 1274126177);
  h ^= h2;
  h ^= h >>> 16;
  let h3 = Math.imul(zi, 1440662683);
  h3 = Math.imul(h3 ^ (h3 >>> 13), 1274126177);
  h ^= h3;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = fade(x - xi);
  const ty = fade(y - yi);
  const tz = fade(z - zi);

  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);

  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;

  const y0 = x00 + (x10 - x00) * ty;
  const y1 = x01 + (x11 - x01) * ty;

  return y0 + (y1 - y0) * tz;
}

export function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise3(x * frequency, y * frequency, z * frequency);
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }

  return sum / normalizer;
}

export interface LandSample {
  score: number;
  elevation: number;
}

export function sampleLand(x: number, y: number, z: number): LandSample {
  const wx = fbm3(x * 2.15 + 9.4, y * 2.15 + 2.7, z * 2.15 + 5.9, 3) - 0.5;
  const wy = fbm3(x * 2.15 + 4.1, y * 2.15 + 8.3, z * 2.15 + 1.6, 3) - 0.5;

  const base = fbm3(
    x * 1.32 + wx * 1.5,
    y * 1.32 + wy * 1.1,
    z * 1.32 + (wx + wy) * 0.8,
    5,
  );

  const detail = fbm3(x * 5.1 + 3.1, y * 5.1 + 7.7, z * 5.1 + 1.3, 3);

  return {
    score: base * 0.84 + detail * 0.16,
    elevation: base,
  };
}

export const LAND_THRESHOLD = 0.49;
export const POLAR_THRESHOLD = 0.95;

export function isLand(score: number, y: number): boolean {
  return Math.abs(y) > POLAR_THRESHOLD || score > LAND_THRESHOLD;
}

/**
 * Baked land mask: 1024 x 512 procedural coverage, bilinearly sampled so
 * coastlines stay consistent and do not shimmer between dot rows.
 */
const MASK_WIDTH = 1024;
const MASK_HEIGHT = 512;
let bakedMask: Uint8Array | null = null;

const DEG = Math.PI / 180;

function buildMask(): Uint8Array {
  const mask = new Uint8Array(MASK_WIDTH * MASK_HEIGHT);

  for (let row = 0; row < MASK_HEIGHT; row += 1) {
    const lat = 90 - (row / (MASK_HEIGHT - 1)) * 180;
    const latRad = lat * DEG;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    for (let column = 0; column < MASK_WIDTH; column += 1) {
      const lon = -180 + (column / (MASK_WIDTH - 1)) * 360;
      const lonRad = lon * DEG;

      const sample = sampleLand(
        cosLat * Math.cos(lonRad),
        sinLat,
        cosLat * Math.sin(lonRad),
      );

      mask[row * MASK_WIDTH + column] = isLand(sample.score, sinLat)
        ? 255
        : 0;
    }
  }

  return mask;
}

export function landMask(): Uint8Array {
  if (!bakedMask) bakedMask = buildMask();
  return bakedMask;
}

export function maskAt(latDeg: number, lonDeg: number): number {
  const mask = landMask();

  let x = ((lonDeg + 180) / 360) * (MASK_WIDTH - 1);
  let y = ((90 - latDeg) / 180) * (MASK_HEIGHT - 1);

  x = Math.max(0, Math.min(MASK_WIDTH - 1.001, x));
  y = Math.max(0, Math.min(MASK_HEIGHT - 1.001, y));

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const i = y0 * MASK_WIDTH + x0;

  const a = mask[i];
  const b = mask[i + 1];
  const c = mask[i + MASK_WIDTH];
  const d = mask[i + MASK_WIDTH + 1];

  return (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) / 255;
}

