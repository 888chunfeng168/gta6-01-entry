// combat.js — the pistol: mouse aim, click to shoot, limited ammo,
// bullets that hit cops, pedestrians and cars, and the punch.
import { CONFIG, clamp } from './config.js';
import { hitsBuilding } from './city.js';
import { addHeat } from './police.js';

export function updateCombat(state, dt) {
  const p = state.player;
  state.fireCooldown = Math.max(0, (state.fireCooldown || 0) - dt);
  state.shotsFiredTimer = Math.max(0, (state.shotsFiredTimer || 0) - dt);

  // Punch on foot with Space: a short-range shove that knocks a ped down.
  if (!p.inCar && state.input.wasPressed('action')) {
    const reach = 46;
    const tx = p.x + Math.cos(p.angle) * reach;
    const ty = p.y + Math.sin(p.angle) * reach;
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - tx, ped.y - ty) < 30) {
        ped.down = true; ped.downTimer = 3;
        ped.vx = Math.cos(p.angle) * 160; ped.vy = Math.sin(p.angle) * 160;
        addHeat(state, 1, 'Assault! A witness called the cops.');
        state.audio.hit();
      }
    }
    for (const cop of state.police.cops) {
      if (Math.hypot(cop.x - tx, cop.y - ty) < 34) {
        cop.x += Math.cos(p.angle) * 60; cop.y += Math.sin(p.angle) * 60;
        state.audio.hit();
      }
    }
  }

  // Shooting: aim with the mouse, click (or hold) to fire. No shooting
  // from a moving car — pull over or get out first.
  if (!p.inCar && (state.input.mouseDown || state.input.mouseClicked)) {
    if (state.fireCooldown <= 0 && state.ammo > 0) {
      state.fireCooldown = CONFIG.combat.fireCooldown;
      state.ammo--;
      state.shotsFiredTimer = 1.2;
      const aim = state.aimAngle;
      const bx = p.x + Math.cos(aim) * 22;
      const by = p.y + Math.sin(aim) * 22;
      state.bullets.push({
        x: bx, y: by, vx: Math.cos(aim) * CONFIG.combat.bulletSpeed,
        vy: Math.sin(aim) * CONFIG.combat.bulletSpeed, life: 0.9,
      });
      state.audio.shoot();
      state.muzzle = 0.06;
      // A gunshot in public draws attention fast: first shot, one star.
      if (state.police.wanted === 0) addHeat(state, 1, 'Shots fired! Someone called the cops.');
    } else if (state.ammo <= 0 && state.input.mouseClicked) {
      state.message = 'Out of ammo — find an ammo pickup (green crate).';
      state.messageTimer = 2;
    }
  }

  // Bullets fly, spark on buildings, and hit people and cars.
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (hitsBuilding(state.city, b.x, b.y, 2)) {
      b.life = 0;
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#e8c33c', size: 3 });
      continue;
    }
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        b.life = 0; ped.down = true; ped.downTimer = 5;
        ped.vx = b.vx * 0.25; ped.vy = b.vy * 0.25;
        addHeat(state, 1, 'You shot a civilian!');
        state.audio.hit();
      }
    }
    for (const cop of state.police.cops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
        b.life = 0;
        cop.x += b.vx * 0.03; cop.y += b.vy * 0.03;
        cop.knocked = (cop.knocked || 0) + 1;
        if (cop.knocked >= 2) cop.gone = true;
        addHeat(state, 1, 'You shot a cop! Wanted level up.');
        state.audio.hit();
      }
    }
    for (const car of state.cars) {
      if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
        b.life = 0;
        state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#e8c33c', size: 4 });
        if (car.driver === 'traffic') { car.driver = null; car.parked = true; car.speed = 0; }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // Ammo / health pickups scattered around the city.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (Math.hypot(pk.x - px, pk.y - py) < 34) {
      pk.taken = true;
      if (pk.kind === 'ammo') { state.ammo = Math.min(CONFIG.combat.maxAmmo, state.ammo + 24); state.message = '+24 ammo'; }
      else { state.player.health = clamp(state.player.health + 40, 0, CONFIG.player.healthMax); state.message = '+40 health'; }
      state.messageTimer = 2;
      state.audio.pickup();
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);
}

export function spawnPickups(state) {
  const spots = [
    { x: 700, y: 500, kind: 'ammo' }, { x: 1900, y: 900, kind: 'health' },
    { x: 2600, y: 300, kind: 'ammo' }, { x: 1200, y: 1700, kind: 'health' },
    { x: 3000, y: 1500, kind: 'ammo' }, { x: 500, y: 2100, kind: 'health' },
  ];
  for (const s of spots) state.pickups.push({ ...s, taken: false, bob: Math.random() * 6 });
}
