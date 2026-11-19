// config.js — every tunable number for Solmar Bay, in one place.
// The city is a fictional sun-soaked coastal town; nothing here copies
// any commercial game. All names, people and places are invented.
export const CONFIG = {
  worldWidth: 3600,
  worldHeight: 2800,
  blockSize: 360,      // city block pitch (road + block)
  roadWidth: 84,
  sidewalk: 16,
  beachHeight: 260,    // sand strip along the south edge
  seaHeight: 140,

  player: {
    radius: 13,
    walkSpeed: 170,
    sprintSpeed: 285,
    healthMax: 100,
    startMoney: 50,
    startAmmo: 24,
  },

  car: {
    length: 52,
    width: 26,
    accel: 420,
    brake: 700,
    reverseAccel: 220,
    maxSpeed: 520,
    maxReverse: 160,
    steer: 2.6,
    drag: 0.55,
    handbrakeDrag: 2.4,
  },

  traffic: {
    count: 16,
    speed: 130,
    parkedCount: 10,
  },

  pedestrians: { count: 34, speed: 55 },

  police: {
    maxCops: 6,          // extra cop cars per wanted star, capped
    copSpeed: 560,
    ramDamage: 9,
    arrestRange: 34,
    decaySeconds: 14,   // wanted falls one star after this long unseen
  },

  combat: {
    pistolDamage: 34,
    bulletSpeed: 900,
    fireCooldown: 0.22,
    maxAmmo: 60,
  },

  camera: { footZoom: 1.0, driveZoom: 0.78, lerp: 5.0 },

  hud: { minimapSize: 166, panelAlpha: 0.55 },

  colors: {
    grass: '#7fae5a',
    sand: '#e8d29a',
    sea: '#2e7fa8',
    seaDeep: '#1f5f84',
    road: '#3a3f46',
    roadLine: '#e8c33c',
    sidewalk: '#9a938a',
    buildingRoof: '#b0563a',
  },
};

// Seeded random: same seed, same city. Mulberry32.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// Smallest signed turn from angle a to angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
