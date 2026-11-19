// city.js — Solmar Bay itself: the road grid, blocks, buildings, beach,
// parks and named landmarks. Everything is generated from a seed so the
// city is the same every visit. Drawing lives in render.js; this file
// only decides *what* is where.
import { CONFIG, makeRng, pick } from './config.js';

const PALETTES = [
  ['#c96f4a', '#d98a5f', '#b0563a'], // terracotta
  ['#e8c98a', '#d9b06a', '#c99a52'], // sandstone
  ['#7fa8c9', '#6a94b8', '#5d86a8'], // sea blue
  ['#e8e4da', '#d9d4c7', '#c7c0ae'], // whitewash
  ['#9ab86a', '#8aa85c', '#7a984e'], // palm green
  ['#c97f9a', '#b86a88', '#a85a78'], // sunset pink
];

const LANDMARKS = [
  { name: 'Marina Pier', kind: 'pier' },
  { name: 'Solmar Bank', kind: 'bank' },
  { name: 'Cafe Luna', kind: 'cafe' },
  { name: 'Bayview Hotel', kind: 'hotel' },
  { name: 'Palm Park', kind: 'park' },
  { name: 'Sunset Garage', kind: 'garage' },
  { name: 'Harbor Market', kind: 'market' },
  { name: 'Rico\'s Diner', kind: 'diner' },
];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const { worldWidth: W, worldHeight: H, blockSize, roadWidth, beachHeight, seaHeight } = CONFIG;
  const city = {
    seed, roadsX: [], roadsY: [], buildings: [], trees: [], parks: [],
    landmarks: [], beach: null, sea: null, spawn: { x: 0, y: 0 },
  };

  // Vertical and horizontal roads on a regular grid.
  for (let x = blockSize; x < W; x += blockSize) city.roadsX.push(x);
  for (let y = blockSize; y < H - beachHeight; y += blockSize) city.roadsY.push(y);

  city.sea = { x: 0, y: H - seaHeight, w: W, h: seaHeight };
  city.beach = { x: 0, y: H - beachHeight - seaHeight, w: W, h: beachHeight };

  // Buildings fill the blocks between roads, skipping the park blocks.
  const parkBlocks = new Set();
  while (parkBlocks.size < 4) {
    parkBlocks.add(Math.floor(rng() * 30));
  }
  let blockIndex = 0;
  for (let bx = 0; bx < city.roadsX.length; bx++) {
    for (let by = 0; by < city.roadsY.length; by++) {
      const x0 = (bx === 0 ? 0 : city.roadsX[bx - 1] + roadWidth / 2) + 14;
      const y0 = (by === 0 ? 0 : city.roadsY[by - 1] + roadWidth / 2) + 14;
      const x1 = city.roadsX[bx] - roadWidth / 2 - 14;
      const y1 = city.roadsY[by] - roadWidth / 2 - 14;
      const isPark = parkBlocks.has(blockIndex);
      blockIndex++;
      if (isPark) {
        city.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t++) {
          city.trees.push({
            x: x0 + 20 + rng() * (x1 - x0 - 40),
            y: y0 + 20 + rng() * (y1 - y0 - 40),
            r: 10 + rng() * 8,
          });
        }
        continue;
      }
      // One or two buildings per block.
      const palette = pick(rng, PALETTES);
      const split = rng() > 0.45;
      const spots = split
        ? [{ x: x0, y: y0, w: (x1 - x0) * 0.46, h: y1 - y0 },
           { x: x0 + (x1 - x0) * 0.54, y: y0, w: (x1 - x0) * 0.46, h: y1 - y0 }]
        : [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
      for (const s of spots) {
        const inset = 6 + rng() * 10;
        city.buildings.push({
          x: s.x + inset, y: s.y + inset,
          w: s.w - inset * 2, h: s.h - inset * 2,
          color: pick(rng, palette),
          roof: pick(rng, palette),
          height: 1 + Math.floor(rng() * 3), // fake storeys for shading
          windows: Math.floor(rng() * 3),
        });
      }
    }
  }

  // Palm trees line the beach and a few sidewalks.
  for (let x = 40; x < W; x += 90 + rng() * 60) {
    city.trees.push({ x, y: city.beach.y + 30 + rng() * 60, r: 12 + rng() * 6, palm: true });
  }
  for (let i = 0; i < 26; i++) {
    const rx = pick(rng, city.roadsX);
    const ry = pick(rng, city.roadsY);
    city.trees.push({ x: rx + (rng() > 0.5 ? 1 : -1) * (roadWidth / 2 + 12), y: ry + (rng() - 0.5) * 200, r: 9 + rng() * 5 });
  }

  // Named landmarks sit on real blocks so missions can point at them.
  const landmarkSpots = [
    { bx: 1, by: 1 }, { bx: 4, by: 0 }, { bx: 7, by: 2 }, { bx: 2, by: 3 },
    { bx: 5, by: 4 }, { bx: 8, by: 1 }, { bx: 3, by: 5 }, { bx: 6, by: 3 },
  ];
  LANDMARKS.forEach((lm, i) => {
    const spot = landmarkSpots[i % landmarkSpots.length];
    const x = city.roadsX[spot.bx] - blockSize / 2;
    const y = city.roadsY[spot.by] - blockSize / 2;
    city.landmarks.push({ ...lm, x, y });
  });

  // Spawn on the road itself, never inside a building: the corner of
  // the second vertical and first horizontal road.
  city.spawn = { x: city.roadsX[2], y: city.roadsY[1] };
  return city;
}

// Is this point on a road (drivable)? Roads are the grid strips.
export function isOnRoad(city, x, y) {
  const { roadWidth } = CONFIG;
  for (const rx of city.roadsX) if (Math.abs(x - rx) < roadWidth / 2) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < roadWidth / 2) return true;
  return false;
}

// Nearest point on the road grid — traffic and parked cars use this.
export function nearestRoadPoint(city, x, y) {
  let bestX = city.roadsX[0], bestD = Infinity;
  for (const rx of city.roadsX) { const d = Math.abs(x - rx); if (d < bestD) { bestD = d; bestX = rx; } }
  let bestY = city.roadsY[0]; bestD = Infinity;
  for (const ry of city.roadsY) { const d = Math.abs(y - ry); if (d < bestD) { bestD = d; bestY = ry; } }
  return { x: bestX, y: bestY };
}

// Does this circle hit a building? Used for walking, driving and bullets.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(CONFIG.worldWidth - margin, x)),
    y: Math.max(margin, Math.min(CONFIG.worldHeight - margin, y)),
  };
}
