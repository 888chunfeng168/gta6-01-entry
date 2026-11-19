// vehicles.js — cars: parked cars to steal, traffic AI that follows the
// road grid, and the player's driving physics (arcade, not a sim).
import { CONFIG, makeRng, pick, clamp, angleDiff } from './config.js';
import { hitsBuilding, nearestRoadPoint, clampToWorld, isOnRoad } from './city.js';

const MODELS = [
  { name: 'Sunrunner', color: '#e84a3f', speed: 1.0 },
  { name: 'Bay Cruiser', color: '#3f7fe8', speed: 0.95 },
  { name: 'Palm Taxi', color: '#e8c33c', speed: 0.9 },
  { name: 'Coast Coupe', color: '#e8e4da', speed: 1.08 },
  { name: 'Dune Buggy', color: '#7fae5a', speed: 0.92 },
  { name: 'Marina Van', color: '#8a6fb8', speed: 0.82 },
  { name: 'Sunset Sedan', color: '#e87fa8', speed: 0.97 },
  { name: 'Harbor Pickup', color: '#5a8a7a', speed: 0.9 },
];

export function makeCar(x, y, angle, model, opts) {
  return {
    x, y, angle,
    speed: 0,
    model: model.name, color: model.color, speedMul: model.speed,
    driver: (opts && opts.driver) || null, // 'player' | 'traffic' | 'cop' | null
    parked: !!(opts && opts.parked),
    stolen: !!(opts && opts.stolen),
    owner: (opts && opts.owner) || 'civilian',
    isCop: !!(opts && opts.isCop),
    wrecked: false,
    // Traffic AI state:
    axis: (opts && opts.axis) || 'x',
    dir: (opts && opts.dir) || 1,
    stuck: 0,
    honk: 0,
    brakeLight: false,
  };
}

export function spawnTraffic(state) {
  const rng = makeRng(state.city.seed + 77);
  const city = state.city;
  // Parked cars along the roads, free for the taking (and the wanted stars).
  for (let i = 0; i < CONFIG.traffic.parkedCount; i++) {
    const rx = pick(rng, city.roadsX);
    const ry = pick(rng, city.roadsY);
    const alongX = rng() > 0.5;
    const car = makeCar(
      alongX ? rx + (rng() - 0.5) * 500 : rx + (rng() > 0.5 ? 34 : -34),
      alongX ? ry + (rng() > 0.5 ? 34 : -34) : ry + (rng() - 0.5) * 500,
      alongX ? (rng() > 0.5 ? 0 : Math.PI) : (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2),
      pick(rng, MODELS), { parked: true, stolen: false });
    state.cars.push(car);
  }
  // Moving traffic on the grid.
  for (let i = 0; i < CONFIG.traffic.count; i++) {
    const alongX = rng() > 0.5;
    const rx = pick(rng, city.roadsX);
    const ry = pick(rng, city.roadsY);
    const dir = rng() > 0.5 ? 1 : -1;
    const car = makeCar(rx, ry, alongX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      pick(rng, MODELS), { driver: 'traffic', axis: alongX ? 'x' : 'y', dir });
    car.speed = CONFIG.traffic.speed * (0.8 + rng() * 0.4);
    state.cars.push(car);
  }
}

// Keep a car out of buildings and inside the world.
function collideCar(state, car) {
  const b = hitsBuilding(state.city, car.x, car.y, 24);
  if (b) {
    // Push back out along the direction we came from.
    car.x -= Math.cos(car.angle) * car.speed * 0.05;
    car.y -= Math.sin(car.angle) * car.speed * 0.05;
    if (Math.abs(car.speed) > 120 && car.driver === 'player') {
      state.audio.crash();
      state.police.addHeat(state, 0, '');
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#e8c33c', size: 5 });
    }
    car.speed *= 0.35;
    return true;
  }
  const c = clampToWorld(car.x, car.y, 30);
  if (c.x !== car.x || c.y !== car.y) { car.x = c.x; car.y = c.y; car.speed *= 0.4; }
  return false;
}

export function updatePlayerCar(state, dt) {
  const car = state.player.inCar;
  if (!car) return;
  const input = state.input;
  const cfg = CONFIG.car;
  const forward = input.down('up') || state.autodrive;
  const back = input.down('down');
  const steer = (input.down('left') ? -1 : 0) + (input.down('right') ? 1 : 0);
  const handbrake = input.down('action');

  if (forward) car.speed += cfg.accel * car.speedMul * dt;
  if (back) {
    if (car.speed > 20) car.speed -= cfg.brake * dt;
    else car.speed -= cfg.reverseAccel * dt;
  }
  if (!forward && !back) car.speed -= Math.sign(car.speed) * cfg.drag * 120 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * cfg.handbrakeDrag * 220 * dt;

  car.speed = clamp(car.speed, -cfg.maxReverse, cfg.maxSpeed * car.speedMul);
  if (Math.abs(car.speed) < 4 && !forward && !back) car.speed = 0;

  const turn = steer * cfg.steer * dt * clamp(Math.abs(car.speed) / 140, 0, 1) * Math.sign(car.speed || 1);
  car.angle += turn;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCar(state, car);

  // Bumping pedestrians while driving is a crime, and it hurts them.
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      ped.down = true; ped.downTimer = 4;
      ped.vx = Math.cos(car.angle) * 220; ped.vy = Math.sin(car.angle) * 220;
      state.police.addHeat(state, 1, 'You ran someone over!');
      state.audio.crash();
      state.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -40, life: 0.5, max: 0.5, color: '#e84a3f', size: 6 });
    }
  }
  state.audio.engine(true, Math.abs(car.speed) / cfg.maxSpeed);
}

export function updateTraffic(state, dt) {
  const city = state.city;
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    const targetSpeed = CONFIG.traffic.speed;
    car.speed += (targetSpeed - car.speed) * dt * 0.8;

    // At an intersection, sometimes turn onto the other road.
    const onX = city.roadsX.some((rx) => Math.abs(car.x - rx) < 6);
    const onY = city.roadsY.some((ry) => Math.abs(car.y - ry) < 6);
    if (onX && onY && Math.random() < dt * 0.5) {
      if (car.axis === 'x') {
        car.axis = 'y'; car.dir = Math.random() > 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'x'; car.dir = Math.random() > 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
    // Gentle steering back onto the lane centre.
    if (car.axis === 'x') {
      const rp = nearestRoadPoint(city, car.x, car.y);
      const laneY = rp.y + (car.dir > 0 ? 18 : -18);
      car.y += clamp(laneY - car.y, -1, 1) * dt * 60;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      const rp = nearestRoadPoint(city, car.x, car.y);
      const laneX = rp.x + (car.dir > 0 ? -18 : 18);
      car.x += clamp(laneX - car.x, -1, 1) * dt * 60;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // Wrap around the world edges so traffic never runs out.
    if (car.x < 20) { car.x = 20; car.axis = 'y'; car.dir = 1; car.angle = Math.PI / 2; }
    if (car.x > CONFIG.worldWidth - 20) { car.x = CONFIG.worldWidth - 20; car.axis = 'y'; car.dir = -1; car.angle = -Math.PI / 2; }
    if (car.y < 20) { car.y = 20; car.axis = 'x'; car.dir = 1; car.angle = 0; }
    if (car.y > CONFIG.worldHeight - 20) { car.y = CONFIG.worldHeight - 20; car.axis = 'x'; car.dir = -1; car.angle = Math.PI; }

    // Don't drive through buildings on a turn.
    if (hitsBuilding(city, car.x, car.y, 22)) {
      car.x -= Math.cos(car.angle) * car.speed * dt * 2;
      car.y -= Math.sin(car.angle) * car.speed * dt * 2;
      car.speed *= 0.5;
    }
    // Don't pile into the player's car.
    const pc = state.player.inCar;
    if (pc && pc !== car) {
      const d = Math.hypot(pc.x - car.x, pc.y - car.y);
      if (d < 60) car.speed = Math.min(car.speed, 40);
    }
  }
}
