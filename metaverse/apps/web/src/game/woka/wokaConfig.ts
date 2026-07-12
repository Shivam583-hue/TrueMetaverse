import { WOKA_ASSET_BASE, WOKA_FILES } from "./wokaAssets";

export type WokaLayer =
  | "body"
  | "eyes"
  | "hair"
  | "clothes"
  | "hat"
  | "accessory";

export const DRAW_ORDER: WokaLayer[] = [
  "body",
  "eyes",
  "hair",
  "clothes",
  "hat",
  "accessory",
];

export type WokaOption = {
  id: string;
  label: string;
  url?: string;
};

export type WokaLayerDef = {
  layer: WokaLayer;
  label: string;
  optional: boolean;
  options: WokaOption[];
};

export type WokaAppearance = Record<WokaLayer, string>;

const NONE: WokaOption = { id: "none", label: "None" };

const META: Record<WokaLayer, { label: string; optional: boolean }> = {
  body: { label: "Skin", optional: false },
  eyes: { label: "Eyes", optional: false },
  hair: { label: "Hair", optional: true },
  clothes: { label: "Clothes", optional: false },
  hat: { label: "Hat", optional: true },
  accessory: { label: "Extras", optional: true },
};

function buildLayer(layer: WokaLayer): WokaLayerDef {
  const meta = META[layer];
  const options: WokaOption[] = WOKA_FILES[layer]!.map((file, i) => ({
    id: `${layer}-${i}`,
    label: `${meta.label} ${i + 1}`,
    url: `${WOKA_ASSET_BASE}/${layer}/${file}`,
  }));
  return {
    layer,
    label: meta.label,
    optional: meta.optional,
    options: meta.optional ? [NONE, ...options] : options,
  };
}

export const WOKA_LAYERS: WokaLayerDef[] = DRAW_ORDER.map(buildLayer);

const BY_LAYER = new Map(WOKA_LAYERS.map((l) => [l.layer, l]));

export function layerDef(layer: WokaLayer): WokaLayerDef {
  return BY_LAYER.get(layer)!;
}

export function optionOf(layer: WokaLayer, id: string): WokaOption {
  const def = layerDef(layer);
  return def.options.find((o) => o.id === id) ?? def.options[0]!;
}

export const DEFAULT_APPEARANCE: WokaAppearance = {
  body: "body-0",
  eyes: "eyes-0",
  hair: "hair-0",
  clothes: "clothes-0",
  hat: "none",
  accessory: "none",
};

export function normalizeAppearance(raw: unknown): WokaAppearance {
  const out: WokaAppearance = { ...DEFAULT_APPEARANCE };
  if (raw && typeof raw === "object") {
    for (const def of WOKA_LAYERS) {
      const value = (raw as Record<string, unknown>)[def.layer];
      if (typeof value === "string" && def.options.some((o) => o.id === value)) {
        out[def.layer] = value;
      }
    }
  }
  return out;
}

export function randomAppearance(): WokaAppearance {
  const out = {} as WokaAppearance;
  for (const def of WOKA_LAYERS) {
    const pool = def.optional
      ? def.options
      : def.options.filter((o) => o.id !== "none");
    out[def.layer] = pool[Math.floor(Math.random() * pool.length)]!.id;
  }
  return out;
}
