// pedestrians.js — the people of Solmar Bay: shoppers, joggers and
// beachgoers strolling the sidewalks, who scatter when shots are fired.
import { CONFIG, makeRng, pick } from './config.js';
import { hitsBuilding, clampToWorld } from './city.js';

const NAMES = ['Mara', 'Theo', 'Luz', 'Dario', 'Priya', 'Ken', 'Sofia', 'Ravi',
  'Elena', 'Marco', 'Aisha', 'Leo', 'Nina', 'Omar', 'Greta', 'Felix'];
const SHIRTS = ['#e84a3f', '#3f7fe8', '#e8c33c', '#7fae5a', '#e87fa8', '#8a6fb8',
  '#e8e4da', '#5a8a7a', '#e88a3f', '#6a94b8'];

export function spawnPedestrians(state) {
  const rng = makeRng(state.city.seed + 31);
  const city = state.city;
  for (let i = 0; i < CONFIG.pedestrians.count; i++) {
    const rx = pick(rng, city.roadsX);
    const ry = pick(rng, city.roadsY);
    // Stand on a sidewalk edge beside a road.
    const onXRoad = rng() > 0.5;
    const x = onXRoad ? rx + (rng() > 0.5 ? 56 : -56) : rx + (rng() - 0.5) * 600;
    const y = onXRoad ? ry + (rng() - 0.5) * 600 : ry + (rng() > 0.5 ? 56 : -56);
    state.peds.push({
      name: pick(rng, NAMES),
      x, y,
      angle: rng() * Math.PI * 2,
      speed: CONFIG.pedestrians.speed * (0.7 + rng() * 0.6),
      shirt: pick(rng, SHIRTS),
      skin: pick(rng, ['#f0c8a0', '#c98d5f', '#8a5a3b', '#e8b88a']),
      scared: 0,
      down: false,
      downTimer: 0,
      vx: 0, vy: 0,
      walkPhase: rng() * 6,
      target: null,
    });
  }
  // A few beachgoers on the sand; they stroll along the beach, not inland.
  for (let i = 0; i < 6; i++) {
    state.peds.push({
      name: pick(rng, NAMES), x: 200 + rng() * (CONFIG.worldWidth - 400),
      y: state.city.beach.y + 40 + rng() * 120,
      angle: rng() * Math.PI * 2, speed: 40, beach: true,
      shirt: pick(rng, SHIRTS), skin: pick(rng, ['#f0c8a0', '#c98d5f', '#8a5a3b']),
      scared: 0, down: false, downTimer: 0, vx: 0, vy: 0, walkPhase: rng() * 6, target: null,
    });
  }
}

function pickStrollTarget(ped, state) {
  if (ped.beach) {
    // Beachgoers wander up and down the sand, never into the streets.
    return {
      x: Math.max(60, Math.min(CONFIG.worldWidth - 60, ped.x + (Math.random() - 0.5) * 500)),
      y: state.city.beach.y + 30 + Math.random() * (state.city.beach.h - 60),
    };
  }
  const city = state.city;
  const rx = pick(Math.random, city.roadsX);
  const ry = pick(Math.random, city.roadsY);
  return { x: rx + (Math.random() > 0.5 ? 56 : -56), y: ry + (Math.random() - 0.5) * 300 };
}

export function updatePedestrians(state, dt) {
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      ped.vx *= 0.9; ped.vy *= 0.9;
      if (ped.downTimer <= 0) { ped.down = false; ped.scared = 3; }
      continue;
    }
    // Fear: gunfire, a speeding car, or a nearby wanted player scares them.
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    if (state.shotsFiredTimer > 0 && dPlayer < 420) ped.scared = Math.max(ped.scared, 2.5);
    if (dPlayer < 120 && state.wanted >= 2) ped.scared = Math.max(ped.scared, 1.5);

    if (ped.scared > 0) {
      ped.scared -= dt;
      const away = Math.atan2(ped.y - py, ped.x - px);
      ped.angle = away;
      const sp = ped.speed * 2.6;
      const nx = ped.x + Math.cos(away) * sp * dt;
      const ny = ped.y + Math.sin(away) * sp * dt;
      if (!hitsBuilding(state.city, nx, ped.y, 10)) ped.x = nx;
      if (!hitsBuilding(state.city, ped.x, ny, 10)) ped.y = ny;
      ped.walkPhase += dt * 16;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
        ped.target = pickStrollTarget(ped, state);
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * ped.speed * dt;
      const ny = ped.y + Math.sin(a) * ped.speed * dt;
      if (!hitsBuilding(state.city, nx, ped.y, 10)) ped.x = nx;
      if (!hitsBuilding(state.city, ped.x, ny, 10)) ped.y = ny;
      ped.walkPhase += dt * 8;
    }
    const c = clampToWorld(ped.x, ped.y, 14);
    ped.x = c.x; ped.y = c.y;
  }
}

// How many pedestrians can currently see the player (for wanted decay).
export function witnessesNear(state, range) {
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  let n = 0;
  for (const ped of state.peds) {
    if (!ped.down && Math.hypot(ped.x - px, ped.y - py) < range) n++;
  }
  return n;
}
