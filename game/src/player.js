// player.js — the hero on foot: movement, sprinting, getting in and out
// of cars, and taking damage. Driving itself lives in vehicles.js.
import { CONFIG, clamp } from './config.js';
import { hitsBuilding, clampToWorld, isOnRoad } from './city.js';

export function createPlayer(city) {
  return {
    x: city.spawn.x, y: city.spawn.y,
    angle: -Math.PI / 2, // facing up the street
    speed: 0,
    radius: CONFIG.player.radius,
    health: CONFIG.player.healthMax,
    inCar: null,
    moving: false,
    walkPhase: 0,
  };
}

export function updatePlayerOnFoot(state, dt) {
  const p = state.player;
  const input = state.input;
  const sprint = input.down('sprint');
  const maxSpeed = sprint ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
  let dx = 0, dy = 0;
  if (input.down('up')) dy -= 1;
  if (input.down('down')) dy += 1;
  if (input.down('left')) dx -= 1;
  if (input.down('right')) dx += 1;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (len > 0) {
    dx /= len; dy /= len;
    p.angle = Math.atan2(dy, dx);
    p.walkPhase += dt * (sprint ? 14 : 9);
    const nx = p.x + dx * maxSpeed * dt;
    const ny = p.y + dy * maxSpeed * dt;
    // Slide along walls: try each axis separately.
    if (!hitsBuilding(state.city, nx, p.y, p.radius - 2)) p.x = nx;
    if (!hitsBuilding(state.city, p.x, ny, p.radius - 2)) p.y = ny;
    const c = clampToWorld(p.x, p.y, p.radius + 2);
    p.x = c.x; p.y = c.y;
    // Wading into the sea is slow and hurts a little.
    if (p.y > state.city.sea.y - 10) {
      p.y = state.city.sea.y - 10;
      damagePlayer(state, 6 * dt, 'sea');
    }
  }
  p.speed = len > 0 ? maxSpeed : 0;
}

// Find the nearest car the player could steal or enter.
export function nearestCar(state, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  p.inCar = car;
  car.driver = 'player';
  car.parked = false;
  state.audio.door();
  if (car.stolen === false && car.owner !== 'player') {
    // Taking a car that is not yours is a crime, and the city notices.
    car.stolen = true;
    state.audio.steal();
    state.police.addHeat(state, 1, 'Grand theft auto');
    state.message = 'You stole the ' + car.model + '! The cops were called.';
    state.messageTimer = 3;
  }
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  p.inCar = null;
  // Step out beside the car, clear of the building.
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 34;
  p.y = car.y + Math.sin(car.angle + side) * 34;
  const c = clampToWorld(p.x, p.y, p.radius + 2);
  p.x = c.x; p.y = c.y;
  p.angle = car.angle;
  state.audio.door();
}

export function damagePlayer(state, amount, source) {
  const p = state.player;
  if (state.shotInvulnerable) return; // staged screenshots never die
  if (state.mode !== 'playing' || p.health <= 0) return;
  p.health = clamp(p.health - amount, 0, CONFIG.player.healthMax);
  state.hurtFlash = Math.min(0.5, (state.hurtFlash || 0) + 0.25);
  if (p.health <= 0) {
    state.mode = 'busted';
    state.audio.busted();
    state.audio.engine(false, 0);
    state.audio.siren(0, false);
    state.bustedReason = source === 'arrest' ? 'Busted by the Solmar Bay PD' : 'You got wasted';
  }
}

export function healPlayer(state, amount) {
  state.player.health = clamp(state.player.health + amount, 0, CONFIG.player.healthMax);
}
