// police.js — the wanted system and the Solmar Bay PD: patrol cars that
// chase and ram, foot cops that try to arrest you, and a wanted level
// that cools off when nobody can see you.
import { CONFIG, clamp, angleDiff, angleTo, dist } from './config.js';
import { makeCar } from './vehicles.js';
import { damagePlayer } from './player.js';
import { witnessesNear } from './pedestrians.js';

export function createPolice() {
  return {
    wanted: 0,          // 0..5 stars
    heat: 0,            // 0..100 within the current star
    unseenTimer: 0,     // seconds since any cop or witness saw the player
    cops: [],           // foot cops {x,y,angle,speed}
    spawnTimer: 0,
  };
}

// A crime adds stars directly: one witnessed crime is one star, up to 5.
// Heat tracks how "hot" the current star is for the HUD; it does not
// gate the first star, so stealing a car always brings the cops.
export function addHeat(state, stars, message) {
  const pol = state.police;
  if (stars <= 0) return;
  pol.wanted = clamp(pol.wanted + stars, 0, 5);
  pol.heat = pol.wanted > 0 ? 60 : 0;
  pol.unseenTimer = 0;
  if (message) { state.message = message; state.messageTimer = 3; }
}

export function setWanted(state, stars, message) {
  state.police.wanted = clamp(stars, 0, 5);
  state.police.heat = stars > 0 ? 40 : 0;
  state.police.unseenTimer = 0;
  if (message) { state.message = message; state.messageTimer = 3.5; }
}

function spawnCopCar(state) {
  const p = state.player.inCar || state.player;
  const angle = Math.random() * Math.PI * 2;
  const d = 700 + Math.random() * 300;
  const x = clamp(p.x + Math.cos(angle) * d, 60, CONFIG.worldWidth - 60);
  const y = clamp(p.y + Math.sin(angle) * d, 60, CONFIG.worldHeight - 60);
  const car = makeCar(x, y, 0, { name: 'PD Interceptor', color: '#20242c', speed: 1.12 },
    { driver: 'cop', isCop: true, stolen: true });
  car.speed = 200;
  state.cars.push(car);
  return car;
}

function spawnFootCop(state) {
  const p = state.player;
  const angle = Math.random() * Math.PI * 2;
  const d = 320 + Math.random() * 160;
  state.police.cops.push({
    x: clamp(p.x + Math.cos(angle) * d, 40, CONFIG.worldWidth - 40),
    y: clamp(p.y + Math.sin(angle) * d, 40, CONFIG.worldHeight - 40),
    angle: 0, speed: 195, walkPhase: 0, punchTimer: 0,
  });
}

function playerPos(state) {
  return state.player.inCar
    ? { x: state.player.inCar.x, y: state.player.inCar.y }
    : { x: state.player.x, y: state.player.y };
}

function playerSpeed(state) {
  return state.player.inCar ? Math.abs(state.player.inCar.speed) : state.player.speed;
}

export function updatePolice(state, dt) {
  const pol = state.police;
  const pos = playerPos(state);

  // Wanted decay: if no cop is close and no pedestrian witnesses the
  // player, the heat cools and stars fall off one at a time.
  const copCars = state.cars.filter((c) => c.isCop && !c.wrecked);
  const nearestCop = copCars.reduce((m, c) => Math.min(m, dist(c.x, c.y, pos.x, pos.y)), Infinity);
  const nearestFoot = pol.cops.reduce((m, c) => Math.min(m, dist(c.x, c.y, pos.x, pos.y)), Infinity);
  const seen = Math.min(nearestCop, nearestFoot) < 420 || witnessesNear(state, 260) > 0;
  if (pol.wanted > 0) {
    if (seen) pol.unseenTimer = 0;
    else {
      pol.unseenTimer += dt;
      if (pol.unseenTimer > CONFIG.police.decaySeconds) {
        pol.unseenTimer = 0;
        pol.wanted--;
        pol.heat = pol.wanted > 0 ? 50 : 0;
        state.message = pol.wanted > 0 ? 'The heat is cooling off…' : 'You lost the cops. Clean.';
        state.messageTimer = 3;
      }
    }
  }

  // Spawn pressure: more stars, more cops, faster.
  const wantCars = pol.wanted >= 1 ? Math.min(1 + pol.wanted, CONFIG.police.maxCops) : 0;
  const wantFoot = pol.wanted >= 2 && !state.player.inCar ? Math.min(pol.wanted - 1, 3) : 0;
  pol.spawnTimer -= dt;
  if (pol.spawnTimer <= 0) {
    if (copCars.length < wantCars) spawnCopCar(state);
    else if (pol.cops.length < wantFoot) spawnFootCop(state);
    pol.spawnTimer = 1.2;
  }

  // Cop cars chase, steer toward the player and ram.
  for (const car of copCars) {
    const target = angleTo(car.x, car.y, pos.x, pos.y);
    const diff = angleDiff(car.angle, target);
    const maxSpeed = CONFIG.police.copSpeed * (0.9 + pol.wanted * 0.04);
    car.speed += (maxSpeed - car.speed) * dt * 0.7;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const d = dist(car.x, car.y, pos.x, pos.y);
    car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
    if (d < 56 && car.ramTimer <= 0) {
      // Ram: one solid hit, then a cooldown so two cops cannot melt the
      // player in a second. Damage the player (or their car) and bounce off.
      car.ramTimer = 0.9;
      car.speed *= 0.45;
      state.audio.crash();
      state.particles.push({ x: pos.x, y: pos.y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: '#e8c33c', size: 6 });
      if (state.player.inCar) {
        state.player.inCar.speed *= 0.7;
        damagePlayer(state, CONFIG.police.ramDamage, 'ram');
      } else {
        damagePlayer(state, CONFIG.police.ramDamage + 3, 'ram');
      }
    }
    // Cop cars give up and despawn when the wanted level clears.
    if (pol.wanted === 0 && d > 900) car.wrecked = true;
  }
  // Remove despawned cop cars.
  state.cars = state.cars.filter((c) => !c.wrecked);

  // Foot cops run at the player and try to arrest them.
  for (const cop of pol.cops) {
    const d = dist(cop.x, cop.y, pos.x, pos.y);
    cop.angle = angleTo(cop.x, cop.y, pos.x, pos.y);
    if (state.player.inCar) {
      // Foot cops cannot arrest a driver; they fall back and despawn.
      cop.x -= Math.cos(cop.angle) * 60 * dt;
      cop.y -= Math.sin(cop.angle) * 60 * dt;
      if (d > 700) cop.gone = true;
    } else {
      const sp = cop.speed * (d < 120 ? 1.15 : 1);
      cop.x += Math.cos(cop.angle) * sp * dt;
      cop.y += Math.sin(cop.angle) * sp * dt;
      cop.walkPhase += dt * 12;
      if (d < CONFIG.police.arrestRange) {
        cop.punchTimer -= dt;
        if (cop.punchTimer <= 0) {
          cop.punchTimer = 0.8;
          damagePlayer(state, 12, 'arrest');
          state.message = 'The cops are grabbing you — run!';
          state.messageTimer = 1.5;
        }
      }
    }
  }
  pol.cops = pol.cops.filter((c) => !c.gone && pol.wanted > 0);
}
