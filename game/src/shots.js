// shots.js — deterministic scene staging for screenshots: a ?shot=
// query param skips the title screen and places the player, cars, cops
// and a mission exactly where the shot needs them.
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { setWanted } from './police.js';

function putPlayerInCar(state, modelName) {
  const car = state.cars.find((c) => c.model === modelName && !c.isCop)
    || state.cars.find((c) => !c.isCop && c.driver !== 'traffic');
  if (!car) return;
  const city = state.city;
  // Start on the west side of a main road, heading east into the city,
  // so the camera stays over streets, never over the empty edge.
  car.x = city.roadsX[1]; car.y = city.roadsY[2];
  car.angle = 0; car.speed = 240; car.parked = false; car.driver = 'player';
  state.player.x = car.x; state.player.y = car.y;
  state.player.inCar = car;
  state.camera.x = car.x; state.camera.y = car.y;
  // Keep pedestrians off the car's path so the staged drive is clean.
  state.peds = state.peds.filter((p) => Math.abs(p.y - car.y) > 130 || p.x < car.x - 100);
  return car;
}

function spawnChaseCops(state, n) {
  const car = state.player.inCar || state.player;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const cop = makeCar(
      car.x + Math.cos(a) * 420, car.y + Math.sin(a) * 320,
      Math.atan2(car.y - (car.y + Math.sin(a) * 200), car.x - (car.x + Math.cos(a) * 260)),
      { name: 'PD Interceptor', color: '#20242c', speed: 1.12 },
      { driver: 'cop', isCop: true, stolen: true });
    cop.speed = 300;
    state.cars.push(cop);
  }
}

export function applyShot(state, shot) {
  const city = state.city;
  state.mode = 'playing';
  state.saveExists = false;
  if (shot === 'chase') {
    // Cover: driving fast, 3 wanted stars, two cop cars closing in,
    // a mission objective and the minimap on the HUD.
    const car = putPlayerInCar(state, 'Coast Coupe');
    if (car) car.speed = 380;
    setWanted(state, 3, 'The PD is on your tail!');
    spawnChaseCops(state, 2);
    startMission(state, 3);
    state.mission.grabbed = true; // mid-escape, heading for Palm Park
    state.message = 'The PD is on your tail — lose them and reach Palm Park!';
    state.messageTimer = 4;
    state.money = 1240;
    state.player.health = 100;
    state.autodrive = true;        // keep the getaway rolling for the shot
    state.shotInvulnerable = true; // the cover star does not die mid-shot
  } else if (shot === 'city') {
    // On foot downtown: pedestrians, parked cars, a landmark, no heat.
    state.player.x = city.roadsX[3] - 60;
    state.player.y = city.roadsY[1] + 60;
    state.player.angle = Math.PI / 4;
    state.camera.x = state.player.x; state.camera.y = state.player.y;
    state.money = 210;
    startMission(state, 0);
  } else if (shot === 'drive') {
    // Cruising with traffic on a main road, mission 3 in progress.
    const car = putPlayerInCar(state, 'Sunrunner');
    if (car) car.speed = 300;
    state.money = 480;
    state.autodrive = true;
    startMission(state, 2);
    state.mission.hasPassenger = true;
    state.message = 'Marco is in — drive him to the Sunset Garage!';
    state.messageTimer = 4;
  } else if (shot === 'mission') {
    // Job 1 in progress on foot, waypoint beacon at Cafe Luna.
    state.player.x = city.roadsX[1] - 40;
    state.player.y = city.roadsY[0] + 120;
    state.player.angle = 0;
    state.camera.x = state.player.x; state.camera.y = state.player.y;
    state.money = 150;
    startMission(state, 0);
  }
  // Let the world settle one tick so traffic and peds spread out.
  state.camera.x = (state.player.inCar || state.player).x;
  state.camera.y = (state.player.inCar || state.player).y;
}
