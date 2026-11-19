// save.js — progress lives in localStorage: money, ammo, health and
// which story mission is next. Nothing else leaves the browser.
const SAVE_KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    // A save with a nonsense money value is corrupt, not a fortune.
    if (typeof data.money !== 'number' || !Number.isFinite(data.money)) return null;
    return data;
  } catch (err) { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.floor(state.money),
      ammo: state.ammo,
      missionIndex: state.mission.index,
      missionsDone: state.mission.done,
      bestMoney: state.bestMoney,
      savedAt: Date.now(),
    }));
  } catch (err) { /* storage full or blocked: the game still plays */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
}
