// input.js — keyboard + mouse state, one clear job: remember what the
// player is pressing so the rest of the game never touches DOM events.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false, // consumed by combat each frame
    // Edge-triggered keys: true for exactly one frame after the press.
    pressed: new Set(),
    pausedToggle: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'action',
    KeyE: 'enter', KeyF: 'enter', // F is a second "get in the car" key
    Escape: 'pause',
    KeyM: 'mission',
    Enter: 'confirm',
  };

  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      if (!input.keys.has(name)) input.pressed.add(name);
      input.keys.add(name);
      e.preventDefault();
    }
    if (e.code === 'Escape') input.pausedToggle = true;
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) input.keys.delete(name);
  });
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.down = (name) => input.keys.has(name);
  // Call once per frame, after the game has read the edge flags.
  input.endFrame = () => { input.pressed.clear(); input.mouseClicked = false; };
  input.wasPressed = (name) => input.pressed.has(name);
  return input;
}
