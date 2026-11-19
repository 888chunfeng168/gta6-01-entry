// missions.js — the story of Solmar Bay: four jobs for a newcomer named
// Rio, handed out by a fixer called Delia Voss. Each mission has an
// objective line, a waypoint on the map, and a cash reward.
import { CONFIG, dist } from './config.js';
import { setWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'delivery',
    title: 'Job 1 — The First Drop',
    giver: 'Delia Voss',
    brief: 'Delia needs a package at Cafe Luna. No questions, no cops. Walk or drive — just get it there.',
    objective: 'Deliver the package to Cafe Luna',
    reward: 150,
    waypoint: 'cafe',
  },
  {
    id: 'lose-heat',
    title: 'Job 2 — Lose the Heat',
    giver: 'Delia Voss',
    brief: 'You were spotted on the pier job. The PD is on you — break line of sight and stay hidden until they give up.',
    objective: 'Lose the cops (wanted level must reach 0)',
    reward: 200,
    waypoint: null,
    startWanted: 2,
  },
  {
    id: 'getaway',
    title: 'Job 3 — The Getaway',
    giver: 'Marco Hale',
    brief: 'Marco is waiting at Harbor Market with a hot ride. Pick him up and get him to the Sunset Garage before the clock runs out.',
    objective: 'Pick up Marco, then reach the Sunset Garage',
    reward: 300,
    waypoint: 'market',
    timeLimit: 75,
  },
  {
    id: 'big-score',
    title: 'Job 4 — The Big Score',
    giver: 'Delia Voss',
    brief: 'The Solmar Bank vault, one quiet morning. Grab the cash, then shake a 3-star wanted level and reach the safehouse at Palm Park.',
    objective: 'Rob the Solmar Bank, then reach Palm Park clean',
    reward: 600,
    waypoint: 'bank',
  },
];

export function createMissionState() {
  return { index: 0, done: 0, stage: 'brief', timer: 0, hasPassenger: false, grabbed: false, active: false };
}

// Landmark lookup: missions point at real named places in the city.
export function waypointFor(state, mission) {
  if (!mission.waypoint) return null;
  const kind = mission.waypoint;
  const lm = state.city.landmarks.find((l) => l.kind === kind);
  if (lm) return { x: lm.x, y: lm.y, name: lm.name };
  return null;
}

export function startMission(state, index) {
  const m = MISSIONS[index];
  if (!m) return;
  state.mission.index = index;
  state.mission.stage = 'active';
  state.mission.active = true;
  state.mission.timer = m.timeLimit || 0;
  state.mission.hasPassenger = false;
  state.mission.grabbed = false;
  state.message = m.title + ' — ' + m.brief;
  state.messageTimer = 6;
  state.audio.mission();
  if (m.startWanted) setWanted(state, m.startWanted, 'The cops are on you!');
}

export function completeMission(state) {
  const m = MISSIONS[state.mission.index];
  state.money += m.reward;
  state.mission.done++;
  state.mission.active = false;
  state.mission.stage = 'done';
  state.message = 'Job complete! +' + m.reward + ' $ — ' + m.title;
  state.messageTimer = 5;
  state.audio.cash();
  state.bestMoney = Math.max(state.bestMoney || 0, state.money);
  // Small heal + ammo top-up between jobs, like a breather.
  state.player.health = Math.min(CONFIG.player.healthMax, state.player.health + 30);
  state.ammo = Math.min(CONFIG.combat.maxAmmo, state.ammo + 12);
  const { writeSave } = state.saveApi;
  writeSave(state);
  // Next job unlocks; the player starts it with M.
  state.mission.index++;
  if (state.mission.index >= MISSIONS.length) {
    state.message = 'All jobs done! Solmar Bay is yours, Rio. Free roam — keep the money coming.';
    state.messageTimer = 6;
  }
}

export function updateMissions(state, dt) {
  const ms = state.mission;
  if (!ms.active) return;
  const m = MISSIONS[ms.index];
  if (!m) { ms.active = false; return; }
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;

  if (m.timeLimit) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      ms.active = false; ms.stage = 'failed';
      state.message = 'Too slow — the job fell through. Press M to try again.';
      state.messageTimer = 4;
      return;
    }
  }

  const wp = waypointFor(state, m);
  const atWaypoint = wp && dist(px, py, wp.x, wp.y) < 90;

  if (m.id === 'delivery' && atWaypoint) completeMission(state);
  else if (m.id === 'lose-heat' && state.police.wanted === 0) completeMission(state);
  else if (m.id === 'getaway') {
    if (!ms.hasPassenger && atWaypoint) {
      ms.hasPassenger = true;
      state.message = 'Marco is in! Now drive to the Sunset Garage — fast.';
      state.messageTimer = 4;
      state.audio.pickup();
    } else if (ms.hasPassenger) {
      const garage = state.city.landmarks.find((l) => l.kind === 'garage');
      if (garage && dist(px, py, garage.x, garage.y) < 90) completeMission(state);
    }
  } else if (m.id === 'big-score') {
    if (!ms.grabbed && atWaypoint) {
      ms.grabbed = true;
      state.money += 0; // the cash lands on escape, not on entry
      setWanted(state, 3, 'The bank alarm is screaming — run!');
      state.message = 'Cash grabbed! Lose the cops and reach Palm Park.';
      state.messageTimer = 4;
      state.audio.cash();
    } else if (ms.grabbed && state.police.wanted === 0) {
      const park = state.city.landmarks.find((l) => l.kind === 'park');
      if (park && dist(px, py, park.x, park.y) < 110) completeMission(state);
    }
  }
}

// Current objective text for the HUD, plus the waypoint to draw.
export function currentObjective(state) {
  const ms = state.mission;
  if (ms.active && MISSIONS[ms.index]) {
    const m = MISSIONS[ms.index];
    let wp = waypointFor(state, m);
    let text = m.objective;
    if (m.id === 'getaway' && ms.hasPassenger) {
      const g = state.city.landmarks.find((l) => l.kind === 'garage');
      wp = g ? { x: g.x, y: g.y, name: g.name } : wp;
      text = 'Drive Marco to the Sunset Garage';
    }
    if (m.id === 'big-score' && ms.grabbed) {
      const p = state.city.landmarks.find((l) => l.kind === 'park');
      wp = p ? { x: p.x, y: p.y, name: p.name } : wp;
      text = state.police.wanted > 0 ? 'Lose the cops, then reach Palm Park' : 'Reach Palm Park to stash the cash';
    }
    if (m.id === 'lose-heat') {
      // Suggest a hiding spot: the park, away from the roads the PD patrols.
      const park = state.city.landmarks.find((l) => l.kind === 'park');
      wp = park ? { x: park.x, y: park.y, name: park.name } : null;
      text = 'Hide in Palm Park until the heat cools off';
    }
    return { text, waypoint: wp, timer: m.timeLimit ? ms.timer : null, title: m.title };
  }
  if (ms.index < MISSIONS.length) {
    return { text: 'Press M to start: ' + MISSIONS[ms.index].title, waypoint: null, timer: null, title: 'Free roam' };
  }
  return { text: 'All jobs done — Solmar Bay is yours. Free roam!', waypoint: null, timer: null, title: 'Free roam' };
}
