// Keyboard + mouse input. Keys are tracked as a live set; edge-triggered actions
// (E, R, M, P, C, Space) are queued and consumed once per frame by the game loop.
export const ACTION_CONFIRM = 1, ACTION_PAUSE = 2, ACTION_INTERACT = 4,
  ACTION_RADIO = 8, ACTION_MUTE = 16, ACTION_CREW = 32, ACTION_PUNCH = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0.5, mouseY = 0.5, mouseDown = false, mouseDownEdge = false;
  let dragDX = 0;

  const keyMap = {
    Enter: ACTION_CONFIRM, Space: ACTION_PUNCH, KeyE: ACTION_INTERACT,
    KeyP: ACTION_PAUSE, Escape: ACTION_PAUSE, KeyR: ACTION_RADIO,
    KeyM: ACTION_MUTE, KeyC: ACTION_CREW,
  };
  function onKeyDown(e) {
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    if (keyMap[e.code]) actions |= keyMap[e.code];
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) / Math.max(1, r.width);
    mouseY = (e.clientY - r.top) / Math.max(1, r.height);
  }
  function onMouseDown(e) { mouseDown = true; mouseDownEdge = true; onMouseMove(e); }
  function onMouseUp() { mouseDown = false; }
  let lastX = null;
  function onDrag(e) {
    if (lastX !== null) dragDX += e.clientX - lastX;
    lastX = e.clientX;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onDrag);
  canvas.addEventListener('mouseleave', () => { lastX = null; });

  return {
    keys,
    axis() {
      // forward/back, strafe/steer: +1 forward, +1 right
      let f = 0, s = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
      return { f, s };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() { const a = actions; actions = 0; return a; },
    takeMouseDown() { const d = mouseDownEdge; mouseDownEdge = false; return d; },
    takeDrag() { const d = dragDX; dragDX = 0; return d; },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    clear() { keys.clear(); actions = 0; },
  };
}
