import type { GameState } from './game';
import { calcGhostY } from './game';
import { COLS, ROWS, COLORS, SHAPES } from './tetrominos';
import type { TetrominoType } from './types';

// ─── Layout ──────────────────────────────────────────────────────────────────

export interface Layout {
  cell: number;
  bx: number; // board left x
  by: number; // board top y
  pw: number; // panel width (right side)
  px: number; // panel left x
}

export function computeLayout(w: number, h: number): Layout {
  const pw = Math.min(110, Math.floor(w * 0.25));
  const px = w - pw;
  const cell = Math.min(Math.floor((px) / COLS), Math.floor(h / ROWS));
  const bw = cell * COLS;
  const bh = cell * ROWS;
  const bx = Math.floor((px - bw) / 2);
  const by = Math.floor((h - bh) / 2);
  return { cell, bx, by, pw, px };
}

// ─── Drawing utilities ────────────────────────────────────────────────────────

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  color: string, alpha = 1,
): void {
  const s = size - 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Base fill
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillRect(x + 1, y + 1, s, s);
  // Inner highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 1, y + 1, s, Math.max(2, Math.floor(s * 0.18)));
  ctx.fillRect(x + 1, y + 1, Math.max(2, Math.floor(s * 0.1)), s);
  // Inner shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y + 1 + s - Math.max(2, Math.floor(s * 0.12)), s, Math.max(2, Math.floor(s * 0.12)));
  ctx.restore();
}

function drawGhostCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
  ctx.restore();
}

// ─── Piece preview (for next / held panels) ───────────────────────────────────

function drawPreviewPiece(
  ctx: CanvasRenderingContext2D,
  type: TetrominoType,
  cx: number, cy: number,
  previewSize: number,
): void {
  const matrix = SHAPES[type];
  const color = COLORS[type];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const c = Math.min(Math.floor(previewSize / Math.max(rows, cols)), 18);
  const ox = cx - (cols * c) / 2;
  const oy = cy - (rows * c) / 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!matrix[y][x]) continue;
      drawCell(ctx, ox + x * c, oy + y * c, c, color);
    }
  }
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  ctx.save();
  ctx.font = `${size}px 'Press Start 2P', monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function pixelLabel(
  ctx: CanvasRenderingContext2D,
  label: string, value: string,
  x: number, y: number, w: number,
  labelSize: number, valueSize: number,
): void {
  pixelText(ctx, label, x + w / 2, y, labelSize, 'rgba(255,255,255,0.4)', 'center');
  pixelText(ctx, value, x + w / 2, y + labelSize + 6, valueSize, '#ffffff', 'center');
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
): void {
  const { cell: C, bx, by, pw, px } = layout;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const bw = C * COLS;
  const bh = C * ROWS;

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, W, H);

  // Subtle scanline texture
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, W, 2);
  }

  // ── Board grid ──────────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(bx + x * C, by);
    ctx.lineTo(bx + x * C, by + bh);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + y * C);
    ctx.lineTo(bx + bw, by + y * C);
    ctx.stroke();
  }
  ctx.restore();

  // ── Placed board cells ───────────────────────────────────────────────────────
  const flashAlpha = state.clearFlash > 0 ? 0.6 + 0.4 * Math.sin(Date.now() * 0.03) : 1;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = state.board[y][x];
      if (cell) {
        drawCell(ctx, bx + x * C, by + y * C, C, cell, flashAlpha);
      }
    }
  }

  // ── Ghost piece ──────────────────────────────────────────────────────────────
  if (!state.gameOver && !state.paused) {
    const ghostY = calcGhostY(state);
    const color = COLORS[state.current.type];
    for (let y = 0; y < state.current.matrix.length; y++) {
      for (let x = 0; x < state.current.matrix[y].length; x++) {
        if (!state.current.matrix[y][x]) continue;
        const py = by + (ghostY + y) * C;
        if (py < by) continue;
        drawGhostCell(ctx, bx + (state.current.pos.x + x) * C, py, C, color);
      }
    }
  }

  // ── Active piece ─────────────────────────────────────────────────────────────
  if (!state.gameOver) {
    const color = COLORS[state.current.type];
    for (let y = 0; y < state.current.matrix.length; y++) {
      for (let x = 0; x < state.current.matrix[y].length; x++) {
        if (!state.current.matrix[y][x]) continue;
        const px2 = bx + (state.current.pos.x + x) * C;
        const py = by + (state.current.pos.y + y) * C;
        if (py < by - C) continue; // off-screen top
        drawCell(ctx, px2, Math.max(py, by - C + 1), C, color);
      }
    }
  }

  // ── Board border ─────────────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();

  // ── Side panel ───────────────────────────────────────────────────────────────
  renderPanel(ctx, state, px, by, pw, bh);

  // ── Overlays ─────────────────────────────────────────────────────────────────
  if (state.paused && !state.gameOver) {
    renderOverlay(ctx, W, H, 'PAUSED', 'TAP TO RESUME');
  }
  if (state.gameOver) {
    renderOverlay(ctx, W, H, 'GAME', 'TAP TO RESTART');
  }
}

function renderPanel(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  x: number, y: number,
  w: number, h: number,
): void {
  const pad = 8;
  const cx = x + w / 2;
  let oy = y + 10;

  // ── SCORE ────────────────────────────────────────────────────────────────────
  pixelLabel(ctx, 'SCORE', String(state.score).padStart(6, '0'), x, oy, w, 6, 8);
  oy += 40;

  // ── LEVEL ────────────────────────────────────────────────────────────────────
  pixelLabel(ctx, 'LEVEL', String(state.level), x, oy, w, 6, 10);
  oy += 40;

  // ── LINES ────────────────────────────────────────────────────────────────────
  pixelLabel(ctx, 'LINES', String(state.lines), x, oy, w, 6, 10);
  oy += 48;

  // ── NEXT ─────────────────────────────────────────────────────────────────────
  pixelText(ctx, 'NEXT', cx, oy, 6, 'rgba(255,255,255,0.4)', 'center');
  oy += 14;
  const boxW = w - pad * 2;
  const boxH = 56;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + pad, oy, boxW, boxH);
  ctx.restore();
  drawPreviewPiece(ctx, state.next.type, cx, oy + boxH / 2, boxW);
  oy += boxH + 16;

  // ── HOLD ─────────────────────────────────────────────────────────────────────
  pixelText(ctx, 'HOLD', cx, oy, 6, 'rgba(255,255,255,0.4)', 'center');
  oy += 14;
  const holdH = 56;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + pad, oy, boxW, holdH);
  ctx.restore();
  if (state.held) {
    ctx.save();
    if (!state.canHold) ctx.globalAlpha = 0.4;
    drawPreviewPiece(ctx, state.held.type, cx, oy + holdH / 2, boxW);
    ctx.restore();
  }
  oy += holdH + 20;

  // ── Controls hint ────────────────────────────────────────────────────────────
  const hints = ['← → move', '↑ rotate', '↓ soft', '⎵ drop', 'C hold', 'P pause'];
  ctx.save();
  ctx.font = `5px 'Press Start 2P', monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const hint of hints) {
    ctx.fillText(hint, cx, oy);
    oy += 12;
  }
  ctx.restore();
}

function renderOverlay(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  line1: string, line2: string,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,16,0.82)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  pixelText(ctx, line1, cx, cy - 28, 18, '#ffffff', 'center');
  pixelText(ctx, line2, cx, cy + 8, 7, 'rgba(255,255,255,0.55)', 'center');
  ctx.restore();
}
