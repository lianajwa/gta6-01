// Keyboard + mouse input. One object owns every key state so the game loop
// and the self-test read the same truth. Pointer lock is optional: dragging
// the mouse orbits the camera, and click-to-lock gives free look.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseDX: 0, mouseDY: 0, mouseDown: false,
    locked: false, wheel: 0,
    pressed: new Set(), // keys pressed since last consume
  };

  function code(e) { return e.code; }

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(code(e));
    state.pressed.add(code(e));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code(e))) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(code(e)));
  window.addEventListener('blur', () => { keys.clear(); state.mouseDown = false; });

  canvas.addEventListener('mousedown', (e) => {
    state.mouseDown = true;
    if (e.button === 0 && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (e) => {
    if (state.locked) { state.mouseDX += e.movementX; state.mouseDY += e.movementY; }
    else if (state.mouseDown) { state.mouseDX += e.movementX; state.mouseDY += e.movementY; }
  });
  window.addEventListener('wheel', (e) => { state.wheel += e.deltaY; }, { passive: true });

  return {
    state,
    down(c) { return keys.has(c); },
    axis(neg, pos) { return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0); },
    // True once for a key pressed since the last frame; call once per frame.
    wasPressed(c) { return state.pressed.has(c); },
    consumeFrame() {
      state.pressed.clear();
      state.mouseDX = 0; state.mouseDY = 0; state.wheel = 0;
    },
    // Test hooks: pretend a key is held, or tap it once.
    testHold(c) { keys.add(c); state.pressed.add(c); },
    // Releasing also clears the pressed flag: a test-held key must not
    // linger as "just pressed" for the next frame after release.
    testRelease(c) { keys.delete(c); state.pressed.delete(c); },
    testClear() { keys.clear(); state.pressed.clear(); },
  };
}
