// Keyboard and pointer input. Held keys give a movement vector; one-shot
// presses (interact, pause, shop keys, radio) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse position is kept in screen pixels and the
// canvas converts it to world aim; clicks queue a fire action.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_FIRE = 8;
export const ACTION_RADIO = 16;
export const ACTION_MUTE = 32;
export const ACTION_SAVE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RADIO = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let lastKey = '';

  function keyDown(event) {
    held.add(event.code);
    if (!event.repeat) {
      lastKey = event.code;
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
      else if (RADIO.has(event.code)) actions |= ACTION_RADIO;
      else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    }
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || CONFIRM.has(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_FIRE;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** Movement vector, each component -1, 0 or 1. */
    move() {
      return {
        x: (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0),
        y: (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0),
      };
    },
    sprint() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The most recent one-shot key code, cleared on read (shop shortcuts). */
    takeKey() {
      const key = lastKey;
      lastKey = '';
      return key;
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
  };
}
