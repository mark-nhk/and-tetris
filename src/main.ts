import { createGame, tick } from './game';
import { computeLayout, render } from './renderer';
import { setupKeyboard, setupTouch } from './input';

// ─── Canvas setup ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width  = window.innerWidth  * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width  = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

resize();
window.addEventListener('resize', resize);

// ─── Game state ───────────────────────────────────────────────────────────────

let state = createGame();

function restart(): void {
  state = createGame();
}

// ─── Input ────────────────────────────────────────────────────────────────────

setupKeyboard(() => state, restart);
setupTouch(canvas, () => state, restart);

// ─── Game loop ────────────────────────────────────────────────────────────────

let lastTime = 0;

function loop(now: number): void {
  const dt = Math.min(now - lastTime, 50); // clamp to avoid spiral of death
  lastTime = now;

  tick(state, dt);

  const layout = computeLayout(canvas.width, canvas.height);
  render(ctx, state, layout);

  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => {
  lastTime = now;
  requestAnimationFrame(loop);
});

// ─── Capacitor integration ────────────────────────────────────────────────────

(async () => {
  // Dynamically import Capacitor plugins so the web build works without them
  try {
    const { App } = await import('@capacitor/app');
    // Pause when app is backgrounded
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && !state.paused) state.paused = true;
    });
    // Handle hardware back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) App.exitApp();
    });
  } catch {
    // Running in browser without Capacitor — safe to ignore
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#080810' });
  } catch {
    // Not a native platform
  }
})();
