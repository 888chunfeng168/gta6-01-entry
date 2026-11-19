// main.js — boot and the game loop for Solmar Bay. It builds the world,
// owns the state object every module reads, and steps update → render
// sixty times a second. No build step, no network, plain ES modules.
import { CONFIG } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { spawnTraffic, updatePlayerCar, updateTraffic } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addHeat, setWanted } from './police.js';
import { updateCombat, spawnPickups } from './combat.js';
import { createMissionState, updateMissions, currentObjective, startMission, MISSIONS } from './missions.js';
import { createCamera, updateCamera, render } from './render.js';
import { drawHud, drawTitle, drawPause, drawBusted } from './hud.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261119);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const city = buildCity(seed);
const saved = loadSave();

const state = {
  canvas, ctx, city,
  mode: 'title',
  time: 0,
  money: saved ? saved.money : CONFIG.player.startMoney,
  bestMoney: saved ? (saved.bestMoney || saved.money) : CONFIG.player.startMoney,
  ammo: saved ? (saved.ammo ?? CONFIG.player.startAmmo) : CONFIG.player.startAmmo,
  health: CONFIG.player.healthMax,
  cars: [], peds: [], bullets: [], particles: [], pickups: [],
  fireCooldown: 0, shotsFiredTimer: 0, muzzle: 0,
  aimAngle: -Math.PI / 2,
  message: '', messageTimer: 0,
  hurtFlash: 0,
  bustedReason: '',
  saveExists: !!saved,
  saveApi: { writeSave },
  input: null, audio: null, camera: null, player: null, police: null,
  mission: createMissionState(),
  waypoint: null,
};

state.input = createInput(canvas);
state.audio = createAudio();
state.camera = createCamera();
state.player = createPlayer(city);
state.player.health = CONFIG.player.healthMax;
state.police = createPolice();
state.police.wanted = 0;
state.mission.index = saved ? Math.min(saved.missionIndex || 0, MISSIONS.length) : 0;
state.mission.done = saved ? (saved.missionsDone || 0) : 0;

spawnTraffic(state);
spawnPedestrians(state);
spawnPickups(state);
state.camera.x = state.player.x;
state.camera.y = state.player.y;

// The wanted helpers live on the police object so every module calls
// them the same way: state.police.addHeat(state, stars, message).
state.police.addHeat = addHeat;
state.police.setWanted = setWanted;

function startGame() {
  state.audio.ensure();
  state.audio.click();
  if (state.mode === 'title' || state.mode === 'busted') {
    if (state.mode === 'busted') {
      // Fresh start after being busted: back on the street, same money.
      state.player = createPlayer(city);
      state.player.health = CONFIG.player.healthMax;
      state.police = createPolice();
      state.police.addHeat = state._addHeat;
      state.police.setWanted = state._setWanted;
      state.cars = state.cars.filter((c) => !c.isCop);
      state.police.cops = [];
      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
    }
    state.mode = 'playing';
    state.message = state.mission.index < MISSIONS.length
      ? 'Welcome back to Solmar Bay, Rio. Press M to start ' + MISSIONS[state.mission.index].title + '.'
      : 'Welcome back to Solmar Bay, Rio. Free roam — the city is yours.';
    state.messageTimer = 5;
  }
}

// Stash the heat helpers so a busted restart can re-attach them.
state._addHeat = state.police.addHeat;
state._setWanted = state.police.setWanted;

canvas.addEventListener('mousedown', () => { state.audio.ensure(); if (state.mode === 'title' || state.mode === 'busted') startGame(); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && (state.mode === 'title' || state.mode === 'busted')) startGame();
  if (e.code === 'KeyR' && state.mode === 'paused') { clearSave(); location.reload(); }
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 1.4);
  state.muzzle = Math.max(0, state.muzzle - dt);

  // Aim follows the mouse in world space.
  const cam = state.camera;
  const wx = cam.x + (state.input.mouseX - canvas.width / 2) / cam.zoom;
  const wy = cam.y + (state.input.mouseY - canvas.height / 2) / cam.zoom;
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  state.aimAngle = Math.atan2(wy - py, wx - px);

  if (state.mode === 'playing') {
    // Pause.
    if (state.input.pausedToggle) { state.mode = 'paused'; state.input.pausedToggle = false; state.audio.engine(false, 0); state.audio.siren(0, false); }
    // Start the next job.
    if (state.input.wasPressed('mission') && !state.mission.active && state.mission.index < MISSIONS.length) {
      startMission(state, state.mission.index);
    }
    // Enter / exit cars.
    if (state.input.wasPressed('enter')) {
      if (state.player.inCar) exitCar(state);
      else {
        const car = nearestCar(state, 70);
        if (car) enterCar(state, car);
      }
    }
    // Enter-car hint when standing by a car.
    const near = state.player.inCar ? null : nearestCar(state, 70);
    state.nearCar = near;

    if (state.player.inCar) updatePlayerCar(state, dt);
    else updatePlayerOnFoot(state, dt);
    updateTraffic(state, dt);
    updatePedestrians(state, dt);
    updatePolice(state, dt);
    updateCombat(state, dt);
    updateMissions(state, dt);

    // Particles fade.
    for (const pt of state.particles) { pt.life -= dt; pt.x += (pt.vx || 0) * dt; pt.y += (pt.vy || 0) * dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Siren while cops are close.
    const anyCopNear = state.cars.some((c) => c.isCop && Math.hypot(c.x - px, c.y - py) < 700);
    state.audio.siren(dt, state.police.wanted > 0 && anyCopNear);

    // Current waypoint for the renderer.
    const obj = currentObjective(state);
    state.waypoint = obj.waypoint || null;

    // Autosave every few seconds while playing.
    state._saveTimer = (state._saveTimer || 0) + dt;
    if (state._saveTimer > 8) { state._saveTimer = 0; writeSave(state); }
  } else if (state.mode === 'paused') {
    if (state.input.pausedToggle) { state.mode = 'playing'; state.input.pausedToggle = false; }
    state.audio.engine(false, 0);
    state.audio.siren(0, false);
  } else {
    // Title / busted: idle camera drift over the city so the menu is alive.
    state.camera.x = city.spawn.x + Math.cos(state.time * 0.05) * 120;
    state.camera.y = city.spawn.y + Math.sin(state.time * 0.04) * 90;
    updateTraffic(state, dt);
    updatePedestrians(state, dt);
  }

  updateCamera(state, dt);
  render(state);
  if (state.mode === 'playing' || state.mode === 'paused') drawHud(ctx, state, canvas.width, canvas.height);
  if (state.mode === 'playing' && state.nearCar && !state.player.inCar) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = 'Press E to steal the ' + state.nearCar.model;
    const w = ctx.measureText(label).width + 24;
    ctx.fillRect(canvas.width / 2 - w / 2, canvas.height - 130, w, 30);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(label, canvas.width / 2, canvas.height - 110);
    ctx.restore();
  }
  if (state.mode === 'title') drawTitle(ctx, state, canvas.width, canvas.height);
  if (state.mode === 'paused') drawPause(ctx, state, canvas.width, canvas.height);
  if (state.mode === 'busted') drawBusted(ctx, state, canvas.width, canvas.height);

  state.input.endFrame();
  state.input.pausedToggle = false;
}

// Screenshot staging must run after the world exists: apply it now, then
// let the loop draw the staged scene.
if (shot) applyShot(state, shot);

// Debug handle for playtesting (read-only from the console).
window.__solmar = state;

requestAnimationFrame(frame);
