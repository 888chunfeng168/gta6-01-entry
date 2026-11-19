// render.js — the camera and every pixel of the world: ground, sea and
// beach, roads, buildings, parks, cars, people, cops, bullets, particles
// and the mission waypoint marker.
import { CONFIG, clamp, lerp } from './config.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, targetZoom: 1 };
}

export function updateCamera(state, dt) {
  const cam = state.camera;
  const p = state.player.inCar || state.player;
  cam.targetZoom = state.player.inCar ? CONFIG.camera.driveZoom : CONFIG.camera.footZoom;
  cam.zoom = lerp(cam.zoom, cam.targetZoom, Math.min(1, dt * 2.5));
  const k = Math.min(1, dt * CONFIG.camera.lerp);
  cam.x = lerp(cam.x, p.x, k);
  cam.y = lerp(cam.y, p.y, k);
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CONFIG.car.length, Wd = CONFIG.car.width;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -L / 2, -Wd / 2, L, Wd, 8); ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRectPath(ctx, -L / 2 + 12, -Wd / 2 + 5, L * 0.42, Wd - 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(L / 2 - 14, -Wd / 2 + 4, 5, Wd - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 7, 3, 5);
  ctx.fillStyle = '#e84a3f';
  ctx.fillRect(-L / 2, -Wd / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2, Wd / 2 - 7, 3, 5);
  if (car.isCop) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const flash = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.beginPath(); ctx.arc(-2, -Wd / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(6, -Wd / 2 - 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.brakeLight) {
    ctx.fillStyle = 'rgba(255,60,40,0.9)';
    ctx.fillRect(-L / 2 - 1, -Wd / 2 + 2, 3, 5);
    ctx.fillRect(-L / 2 - 1, Wd / 2 - 7, 3, 5);
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, shirt, skin, walkPhase, down, isCop) {
  ctx.save();
  ctx.translate(x, y);
  if (down) { ctx.rotate(Math.PI / 2); }
  const bob = down ? 0 : Math.sin(walkPhase) * 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Legs.
  ctx.strokeStyle = isCop ? '#20242c' : '#3a3f46';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-Math.sin(walkPhase) * 4 + bob * 0.4, 10);
  ctx.moveTo(0, 0); ctx.lineTo(Math.sin(walkPhase) * 4 - bob * 0.4, 10);
  ctx.stroke();
  // Body.
  ctx.fillStyle = isCop ? '#2c4a7a' : shirt;
  ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 2, -2 + Math.sin(angle) * 2, 6, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -9, 12, 4);
  }
  ctx.restore();
}

export function render(state) {
  const ctx = state.ctx;
  const canvas = state.canvas;
  const W = canvas.width, H = canvas.height;
  const cam = state.camera;
  const city = state.city;

  // Sky-tinted backdrop, then the world in camera space.
  ctx.fillStyle = '#8fc3e8';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const viewL = cam.x - W / 2 / cam.zoom - 60;
  const viewR = cam.x + W / 2 / cam.zoom + 60;
  const viewT = cam.y - H / 2 / cam.zoom - 60;
  const viewB = cam.y + H / 2 / cam.zoom + 60;

  // Ground.
  ctx.fillStyle = CONFIG.colors.grass;
  ctx.fillRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
  // Beach + sea along the south edge.
  ctx.fillStyle = CONFIG.colors.sand;
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  ctx.fillStyle = CONFIG.colors.sea;
  ctx.fillRect(city.sea.x, city.sea.y, city.sea.w, city.sea.h);
  ctx.fillStyle = CONFIG.colors.seaDeep;
  for (let x = 0; x < CONFIG.worldWidth; x += 180) {
    ctx.fillRect(x + ((state.time * 12 + x) % 180), city.sea.y + 30 + (x % 3) * 30, 60, 4);
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > viewR || park.x + park.w < viewL || park.y > viewB || park.y + park.h < viewT) continue;
    ctx.fillStyle = '#6a9a4e';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#4a7a38'; ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }

  // Roads.
  ctx.fillStyle = CONFIG.colors.road;
  for (const rx of city.roadsX) ctx.fillRect(rx - CONFIG.roadWidth / 2, 0, CONFIG.roadWidth, CONFIG.worldHeight - CONFIG.beachHeight - CONFIG.seaHeight);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - CONFIG.roadWidth / 2, CONFIG.worldWidth, CONFIG.roadWidth);
  // Sidewalks.
  ctx.fillStyle = CONFIG.colors.sidewalk;
  for (const rx of city.roadsX) {
    ctx.fillRect(rx - CONFIG.roadWidth / 2 - CONFIG.sidewalk, 0, CONFIG.sidewalk, CONFIG.worldHeight - CONFIG.beachHeight - CONFIG.seaHeight);
    ctx.fillRect(rx + CONFIG.roadWidth / 2, 0, CONFIG.sidewalk, CONFIG.worldHeight - CONFIG.beachHeight - CONFIG.seaHeight);
  }
  for (const ry of city.roadsY) {
    ctx.fillRect(0, ry - CONFIG.roadWidth / 2 - CONFIG.sidewalk, CONFIG.worldWidth, CONFIG.sidewalk);
    ctx.fillRect(0, ry + CONFIG.roadWidth / 2, CONFIG.worldWidth, CONFIG.sidewalk);
  }
  // Centre dashes.
  ctx.fillStyle = CONFIG.colors.roadLine;
  for (const rx of city.roadsX) {
    for (let y = 20; y < CONFIG.worldHeight; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of city.roadsY) {
    for (let x = 20; x < CONFIG.worldWidth; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }

  // Buildings with a sun-side shade and a few windows.
  for (const b of city.buildings) {
    if (b.x > viewR || b.x + b.w < viewL || b.y > viewB || b.y + b.h < viewT) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, Math.min(18, b.h - 10));
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 40));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx + cy) % 2 === 0) ctx.fillRect(b.x + 10 + cx * 34, b.y + 26 + cy * 40, 12, 14);
      }
    }
  }

  // Trees (palms on the beach, round trees elsewhere).
  for (const t of city.trees) {
    if (t.x < viewL || t.x > viewR || t.y < viewT || t.y > viewB) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 8); ctx.lineTo(t.x + 3, t.y - 8); ctx.stroke();
      ctx.fillStyle = '#4a9a3a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * 10, t.y - 10 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3f7a34';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57a047';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Landmark labels.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const lm of city.landmarks) {
    if (lm.x < viewL || lm.x > viewR || lm.y < viewT || lm.y > viewB) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const tw = ctx.measureText(lm.name).width + 14;
    ctx.fillRect(lm.x - tw / 2, lm.y - 12, tw, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(lm.name, lm.x, lm.y + 4);
  }

  // Pickups (green ammo crates, red health kits).
  for (const pk of state.pickups) {
    const bob = Math.sin(state.time * 3 + pk.bob) * 3;
    ctx.fillStyle = pk.kind === 'ammo' ? '#2fae4e' : '#e84a3f';
    ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(pk.kind === 'ammo' ? 'A' : '+', pk.x, pk.y + 4 + bob);
  }

  // Mission waypoint: a tall pulsing beacon + a ground ring.
  const wp = state.waypoint;
  if (wp) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.moveTo(wp.x, wp.y - 52); ctx.lineTo(wp.x - 10, wp.y - 30); ctx.lineTo(wp.x + 10, wp.y - 30); ctx.closePath(); ctx.fill();
  }

  // Cars (traffic, parked, cop, player) — parked cars sit under people.
  // The player's own car gets a white outline so it is easy to spot.
  const cars = [...state.cars].sort((a, b) => a.y - b.y);
  for (const car of cars) {
    if (car === state.player.inCar) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-CONFIG.car.length / 2 - 3, -CONFIG.car.width / 2 - 3, CONFIG.car.length + 6, CONFIG.car.width + 6);
      ctx.restore();
    }
    drawCarShape(ctx, car);
  }

  // Pedestrians and foot cops.
  for (const ped of state.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, ped.walkPhase, ped.down, false);
  }
  for (const cop of state.police.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#2c4a7a', '#e8b88a', cop.walkPhase, false, true);
  }

  // The player on foot (hidden while driving — they are in the car).
  const p = state.player;
  if (!p.inCar) {
    drawPerson(ctx, p.x, p.y, p.angle, '#e8c33c', '#f0c8a0', p.walkPhase, false, false);
    // Aim line + muzzle flash.
    const aim = state.aimAngle;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(aim) * 18, p.y + Math.sin(aim) * 18);
    ctx.lineTo(p.x + Math.cos(aim) * 46, p.y + Math.sin(aim) * 46); ctx.stroke();
    if (state.muzzle > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(aim) * 26, p.y + Math.sin(aim) * 26, 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Bullets and particles.
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Warm late-afternoon light over everything.
  ctx.fillStyle = 'rgba(255,190,90,0.06)';
  ctx.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);

  ctx.restore();
}
