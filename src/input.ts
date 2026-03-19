import type { GameState } from './game';
import {
  moveLeft, moveRight, softDrop, hardDrop,
  rotate, holdPiece, togglePause,
} from './game';

// ─── Keyboard ─────────────────────────────────────────────────────────────────

export function setupKeyboard(
  getState: () => GameState,
  onRestart: () => void,
): () => void {
  // DAS (Delayed Auto-Shift) parameters
  const DAS_DELAY = 170; // ms before repeat starts
  const DAS_RATE  = 50;  // ms per repeat tick

  let dasDir: 'left' | 'right' | null = null;
  let dasTimer: ReturnType<typeof setTimeout> | null = null;
  let dasInterval: ReturnType<typeof setInterval> | null = null;

  function startDAS(dir: 'left' | 'right'): void {
    stopDAS();
    dasDir = dir;
    const fn = dir === 'left'
      ? () => moveLeft(getState())
      : () => moveRight(getState());
    fn();
    dasTimer = setTimeout(() => {
      dasInterval = setInterval(fn, DAS_RATE);
    }, DAS_DELAY);
  }

  function stopDAS(): void {
    if (dasTimer)    clearTimeout(dasTimer);
    if (dasInterval) clearInterval(dasInterval);
    dasTimer = dasInterval = null;
    dasDir = null;
  }

  function onKeyDown(e: KeyboardEvent): void {
    const s = getState();
    switch (e.code) {
      case 'ArrowLeft':  case 'KeyA': e.preventDefault(); startDAS('left');  break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); startDAS('right'); break;
      case 'ArrowDown':  case 'KeyS': e.preventDefault(); softDrop(s);       break;
      case 'ArrowUp':    case 'KeyW':
      case 'KeyX':       e.preventDefault(); rotate(s);                      break;
      case 'Space':      e.preventDefault();
        if (s.gameOver) { onRestart(); } else { hardDrop(s); }              break;
      case 'KeyC':       e.preventDefault(); holdPiece(s);                   break;
      case 'KeyP': case 'Escape': e.preventDefault();
        if (s.gameOver) { onRestart(); } else { togglePause(s); }           break;
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'ArrowLeft'  && dasDir === 'left')  stopDAS();
    if (e.code === 'ArrowRight' && dasDir === 'right') stopDAS();
    if (e.code === 'KeyA'       && dasDir === 'left')  stopDAS();
    if (e.code === 'KeyD'       && dasDir === 'right') stopDAS();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    stopDAS();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

// ─── Touch ───────────────────────────────────────────────────────────────────

interface TouchStart {
  x: number;
  y: number;
  t: number;
  id: number;
}

export function setupTouch(
  canvas: HTMLCanvasElement,
  getState: () => GameState,
  onRestart: () => void,
): () => void {
  const SWIPE_X_THRESHOLD = 28;  // px to count as horizontal swipe
  const SWIPE_Y_DOWN      = 40;  // px down → soft drop hold
  const SWIPE_Y_UP        = -60; // px up → hard drop
  const TAP_MAX_DIST      = 15;  // px radius for tap
  const TAP_MAX_MS        = 220; // ms max for tap

  const touches = new Map<number, TouchStart>();

  let softDropInterval: ReturnType<typeof setInterval> | null = null;

  function clearSoftDrop(): void {
    if (softDropInterval) { clearInterval(softDropInterval); softDropInterval = null; }
  }

  function onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY, t: Date.now(), id: t.identifier });
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    clearSoftDrop();
    const s = getState();

    for (const t of Array.from(e.changedTouches)) {
      const start = touches.get(t.identifier);
      if (!start) continue;
      touches.delete(t.identifier);

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      const dist = Math.hypot(dx, dy);

      if (s.gameOver || s.paused) {
        if (dist < TAP_MAX_DIST && dt < TAP_MAX_MS) {
          onRestart();
        }
        continue;
      }

      // Hard drop: swipe up
      if (dy < SWIPE_Y_UP && Math.abs(dx) < Math.abs(dy)) {
        hardDrop(s);
        continue;
      }

      // Horizontal swipe
      if (Math.abs(dx) > SWIPE_X_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) moveLeft(s);
        else        moveRight(s);
        continue;
      }

      // Tap → rotate
      if (dist < TAP_MAX_DIST && dt < TAP_MAX_MS) {
        rotate(s);
        continue;
      }
    }
  }

  function onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    clearSoftDrop();
    const s = getState();
    if (s.gameOver || s.paused) return;

    for (const t of Array.from(e.changedTouches)) {
      const start = touches.get(t.identifier);
      if (!start) continue;
      const dy = t.clientY - start.y;
      if (dy > SWIPE_Y_DOWN) {
        // Continuous soft drop while holding swipe down
        if (!softDropInterval) {
          softDrop(s);
          softDropInterval = setInterval(() => softDrop(getState()), 80);
        }
      }
    }
  }

  const opts: AddEventListenerOptions = { passive: false };
  canvas.addEventListener('touchstart', onTouchStart, opts);
  canvas.addEventListener('touchend',   onTouchEnd,   opts);
  canvas.addEventListener('touchmove',  onTouchMove,  opts);

  return () => {
    clearSoftDrop();
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchend',   onTouchEnd);
    canvas.removeEventListener('touchmove',  onTouchMove);
  };
}
