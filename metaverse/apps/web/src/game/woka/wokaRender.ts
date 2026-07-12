import {
  DRAW_ORDER,
  optionOf,
  type WokaAppearance,
  type WokaLayer,
} from "./wokaConfig";

export const FRAME_W = 32;
export const FRAME_H = 48;
export const COLS = 3;
export const ROWS = 4;

export type DirName = "down" | "left" | "right" | "up";
export const DIRECTIONS: DirName[] = ["down", "left", "right", "up"];
export const DIR_INDEX: Record<DirName, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

type Canvas = HTMLCanvasElement;

function newCanvas(w: number, h: number): Canvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const CX = FRAME_W / 2;
const HEAD_CY = 15;
const HEAD_R = 8;
const TORSO_TOP = 21;
const TORSO_BOTTOM = 37;
const TORSO_HALF = 8;
const LEG_TOP = 37;
const LEG_BOTTOM = 46;
const LEG_W = 5;

function stepPhase(col: number): { bob: number; lift: number } {
  if (col === 0) return { bob: -1, lift: 1 };
  if (col === 2) return { bob: -1, lift: -1 };
  return { bob: 0, lift: 0 };
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: number,
  col: number,
): void {
  const { bob, lift } = stepPhase(col);
  const t = bob;
  const dark = shade(color, -28);

  if (dir === 1 || dir === 2) {
    const front = dir === 2 ? 1 : -1;
    ctx.fillStyle = dark;
    ctx.fillRect(CX - LEG_W / 2 - front * lift * 2, LEG_TOP + t, LEG_W, LEG_BOTTOM - LEG_TOP);
    ctx.fillStyle = color;
    ctx.fillRect(CX - LEG_W / 2 + front * lift * 2, LEG_TOP + t, LEG_W, LEG_BOTTOM - LEG_TOP);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(CX - LEG_W - 1, LEG_TOP + t + Math.max(0, lift), LEG_W, LEG_BOTTOM - LEG_TOP);
    ctx.fillRect(CX + 1, LEG_TOP + t + Math.max(0, -lift), LEG_W, LEG_BOTTOM - LEG_TOP);
  }

  roundRect(ctx, CX - TORSO_HALF, TORSO_TOP + t, TORSO_HALF * 2, TORSO_BOTTOM - TORSO_TOP, 4);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(CX, HEAD_CY + t, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawClothes(
  ctx: CanvasRenderingContext2D,
  color: string,
  _dir: number,
  col: number,
): void {
  const { bob } = stepPhase(col);
  roundRect(
    ctx,
    CX - TORSO_HALF - 1,
    TORSO_TOP + bob + 2,
    (TORSO_HALF + 1) * 2,
    TORSO_BOTTOM - TORSO_TOP,
    4,
  );
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = shade(color, -24);
  ctx.fillRect(CX - 1, TORSO_TOP + bob + 3, 2, TORSO_BOTTOM - TORSO_TOP - 2);
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: number,
  col: number,
): void {
  if (dir === 3) return;
  const { bob } = stepPhase(col);
  const y = HEAD_CY + bob + 1;
  ctx.fillStyle = color;
  if (dir === 0) {
    dot(ctx, CX - 3.5, y, 1.6);
    dot(ctx, CX + 3.5, y, 1.6);
  } else if (dir === 1) {
    dot(ctx, CX - 4, y, 1.6);
  } else {
    dot(ctx, CX + 4, y, 1.6);
  }
}

function drawHair(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: number,
  col: number,
): void {
  const { bob } = stepPhase(col);
  const cy = HEAD_CY + bob;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 3) {
    ctx.arc(CX, cy, HEAD_R + 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(CX, cy, HEAD_R + 0.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(CX - HEAD_R - 0.5, cy - 1, 2.5, 5);
    ctx.fillRect(CX + HEAD_R - 2, cy - 1, 2.5, 5);
    if (dir === 0) ctx.fillRect(CX - HEAD_R, cy - HEAD_R, HEAD_R * 2, 4);
  }
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: number,
  col: number,
): void {
  const { bob } = stepPhase(col);
  const cy = HEAD_CY + bob;
  ctx.fillStyle = color;
  roundRect(ctx, CX - HEAD_R - 1, cy - HEAD_R - 3, (HEAD_R + 1) * 2, 5, 2);
  ctx.fill();
  if (dir !== 3) {
    ctx.fillStyle = shade(color, -20);
    ctx.fillRect(CX - HEAD_R - 2, cy - HEAD_R + 1, (HEAD_R + 2) * 2, 2);
  }
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: number,
  col: number,
  optionId: string,
): void {
  if (dir === 3) return;
  const { bob } = stepPhase(col);
  const y = HEAD_CY + bob + 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = optionId === "accessory-shades" ? color : "transparent";
  ctx.lineWidth = 1;
  const draw = (x: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.stroke();
    if (optionId === "accessory-shades") ctx.fill();
  };
  if (dir === 0) {
    draw(CX - 3.5);
    draw(CX + 3.5);
    ctx.beginPath();
    ctx.moveTo(CX - 1.3, y);
    ctx.lineTo(CX + 1.3, y);
    ctx.stroke();
  } else {
    draw(dir === 1 ? CX - 4 : CX + 4);
  }
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: WokaLayer,
  optionId: string,
  color: string,
  dir: number,
  col: number,
): void {
  if (optionId === "none") return;
  switch (layer) {
    case "body":
      return drawBody(ctx, color, dir, col);
    case "clothes":
      return drawClothes(ctx, color, dir, col);
    case "eyes":
      return drawEyes(ctx, color, dir, col);
    case "hair":
      return drawHair(ctx, color, dir, col);
    case "hat":
      return drawHat(ctx, color, dir, col);
    case "accessory":
      return drawAccessory(ctx, color, dir, col, optionId);
  }
}

export function buildLayerSheet(layer: WokaLayer, optionId: string): Canvas {
  const canvas = newCanvas(FRAME_W * COLS, FRAME_H * ROWS);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const option = optionOf(layer, optionId);
  for (let dir = 0; dir < ROWS; dir++) {
    for (let col = 0; col < COLS; col++) {
      ctx.save();
      ctx.translate(col * FRAME_W, dir * FRAME_H);
      drawLayer(ctx, layer, option.id, option.color, dir, col);
      ctx.restore();
    }
  }
  return canvas;
}

export function drawComposite(
  ctx: CanvasRenderingContext2D,
  appearance: WokaAppearance,
  dir: number,
  col: number,
): void {
  for (const layer of DRAW_ORDER) {
    const optionId = appearance[layer];
    if (optionId === "none") continue;
    const option = optionOf(layer, optionId);
    drawLayer(ctx, layer, option.id, option.color, dir, col);
  }
}

export function compositeCanvas(
  appearance: WokaAppearance,
  dir: number,
  col: number,
  scale = 1,
): Canvas {
  const canvas = newCanvas(FRAME_W * scale, FRAME_H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  drawComposite(ctx, appearance, dir, col);
  return canvas;
}

export function appearanceThumbnail(appearance: WokaAppearance, scale = 2): string {
  return compositeCanvas(appearance, 0, 1, scale).toDataURL();
}
