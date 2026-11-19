// hud.js — everything drawn on top of the world: health, money, wanted
// stars, ammo, the minimap, the objective line, messages, and the
// title / pause / busted screens.
import { CONFIG } from './config.js';
import { currentObjective, MISSIONS } from './missions.js';

export function drawHud(ctx, state, W, H) {
  const p = state.player;
  // Top-left: health bar + money + ammo.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 250, 86, 10); ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.fillText('RIO  •  SOLMAR BAY', 24, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 44, 180, 12);
  ctx.fillStyle = p.health > 50 ? '#58c96b' : p.health > 25 ? '#e8c33c' : '#e84a3f';
  ctx.fillRect(24, 44, 180 * (p.health / CONFIG.player.healthMax), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 210, 55);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('$' + Math.floor(state.money), 24, 80);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(p.inCar ? 'DRIVING  •  ' + p.inCar.model : 'ON FOOT  •  AMMO ' + state.ammo, 110, 80);

  // Top-right: wanted stars on a dark pill so they read over any building.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W - 192, 12, 180, 62, 10); ctx.fill();
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.police.wanted ? '#ffd23c' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 24 - i * 30, 46);
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(state.police.wanted > 0 ? 'WANTED' : 'CLEAN', W - 24, 66);

  // Objective line under the stars.
  const obj = currentObjective(state);
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(obj.text).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, (W - ow) / 2, 12, ow, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(obj.text, W / 2, 32);
  if (obj.timer != null) {
    ctx.fillStyle = obj.timer < 15 ? '#ff6b5e' : '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(Math.ceil(obj.timer) + 's', W / 2, 62);
  }

  // Bottom-right: minimap.
  const mm = CONFIG.hud.minimapSize;
  drawMinimap(ctx, state, W - mm - 12, H - mm - 12, mm, mm);

  // Bottom-left: speed + controls hint.
  ctx.textAlign = 'left';
  if (p.inCar) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    ctx.fillText(kmh + ' km/h', 24, H - 24);
  }
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD move/drive • E enter car • Space punch/handbrake • Click shoot • Shift sprint • M mission • Esc pause', 24, H - 8);

  // Centre message banner, wrapped to fit the screen.
  if (state.message && state.messageTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    const maxW = W - 120;
    const words = state.message.split(' ');
    const lines = [''];
    for (const word of words) {
      const trial = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + word : word;
      if (ctx.measureText(trial).width > maxW && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = trial;
    }
    const shown = lines.slice(0, 2);
    const bw = Math.min(maxW, Math.max(...shown.map((l) => ctx.measureText(l).width)) + 36);
    const bh = shown.length * 24 + 14;
    ctx.fillStyle = 'rgba(20,20,30,0.72)';
    roundRect(ctx, (W - bw) / 2, H - 210 - (shown.length - 1) * 12, bw, bh, 9); ctx.fill();
    ctx.fillStyle = '#fff';
    shown.forEach((line, i) => ctx.fillText(line, W / 2, H - 186 - (shown.length - 1) * 12 + i * 24));
  }

  // Red flash when hurt.
  if (state.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(232,74,63,' + Math.min(0.35, state.hurtFlash) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / CONFIG.worldWidth, sy = h / CONFIG.worldHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,10,0.72)';
  roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 10); ctx.fill();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // Ground, sea, beach.
  ctx.fillStyle = '#5d8a48'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x, y + state.city.sea.y * sy, w, state.city.sea.h * sy);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + state.city.beach.y * sy, w, state.city.beach.h * sy);
  // Roads.
  ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 3;
  for (const rx of state.city.roadsX) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + h); ctx.stroke(); }
  for (const ry of state.city.roadsY) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + w, y + ry * sy); ctx.stroke(); }
  // Waypoint.
  const obj = currentObjective(state);
  if (obj.waypoint) {
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(x + obj.waypoint.x * sx, y + obj.waypoint.y * sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }
  // Cops (blue), player (white arrow), traffic (grey dots).
  ctx.fillStyle = '#4a90ff';
  for (const car of state.cars) if (car.isCop) { ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const car of state.cars) if (!car.isCop && car.driver === 'traffic') ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2, 2);
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + px * sx, y + py * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function menuPanel(ctx, W, H, title, lines, footer) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 150);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 100 + i * 30));
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(footer, W / 2, H / 2 + 110);
  ctx.restore();
}

export function drawTitle(ctx, state, W, H) {
  menuPanel(ctx, W, H, 'SOLMAR BAY', [
    'A sun-soaked open-world crime story.',
    'Rio just rolled into town with $50 and a borrowed pistol.',
    'Delia Voss has jobs. The Solmar Bay PD has other ideas.',
    '',
    'WASD / arrows — move & drive      E — steal / enter car',
    'Mouse — aim      Click — shoot      Space — punch / handbrake',
    'Shift — sprint      M — start next job      Esc — pause',
    '',
    'Steal cars, lose the cops, run the jobs, get rich.',
  ], state.saveExists ? 'Press ENTER to continue your story  •  or click to start' : 'Press ENTER or click to start');
}

export function drawPause(ctx, state, W, H) {
  menuPanel(ctx, W, H, 'PAUSED', [
    'Jobs done: ' + state.mission.done + ' of ' + MISSIONS.length,
    'Money: $' + Math.floor(state.money),
    'Wanted: ' + state.police.wanted + ' star' + (state.police.wanted === 1 ? '' : 's'),
    '',
    'Esc — resume      R — restart from save',
  ], 'Solmar Bay waits for no one.');
}

export function drawBusted(ctx, state, W, H) {
  menuPanel(ctx, W, H, 'BUSTED', [
    state.bustedReason || 'The run is over.',
    'The Solmar Bay PD impounded your ride and your pride.',
    'Money kept: $' + Math.floor(state.money),
    'Jobs done: ' + state.mission.done + ' of ' + MISSIONS.length,
  ], 'Press ENTER to get back out there');
}
