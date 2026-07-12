import {
  DRAW_ORDER,
  optionOf,
  type WokaAppearance,
  type WokaLayer,
} from "./wokaConfig";

export const FRAME_W = 32;
export const FRAME_H = 32;
export const COLS = 3;
export const ROWS = 4;

export type DirName = "down" | "left" | "right" | "up";
export const DIR_INDEX: Record<DirName, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export const WALK_COLS = [0, 1, 2, 1];
export const IDLE_COL = 1;

const imageCache = new Map<string, HTMLImageElement>();
const loadPromises = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);
  let promise = loadPromises.get(url);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
    loadPromises.set(url, promise);
  }
  return promise;
}

export type LoadedLayer = { layer: WokaLayer; img: HTMLImageElement };

export function appearanceUrls(appearance: WokaAppearance): string[] {
  const urls: string[] = [];
  for (const layer of DRAW_ORDER) {
    const option = optionOf(layer, appearance[layer]);
    if (option.url) urls.push(option.url);
  }
  return urls;
}

export async function loadAppearance(
  appearance: WokaAppearance,
): Promise<LoadedLayer[]> {
  const layers: { layer: WokaLayer; url: string }[] = [];
  for (const layer of DRAW_ORDER) {
    const option = optionOf(layer, appearance[layer]);
    if (option.url) layers.push({ layer, url: option.url });
  }
  const imgs = await Promise.all(layers.map((l) => loadImage(l.url)));
  return layers.map((l, i) => ({ layer: l.layer, img: imgs[i]! }));
}

export function drawComposite(
  ctx: CanvasRenderingContext2D,
  loaded: LoadedLayer[],
  dir: number,
  col: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const { img } of loaded) {
    ctx.drawImage(
      img,
      col * FRAME_W,
      dir * FRAME_H,
      FRAME_W,
      FRAME_H,
      0,
      0,
      FRAME_W,
      FRAME_H,
    );
  }
}
