export type WokaLayer =
  | "body"
  | "clothes"
  | "eyes"
  | "hair"
  | "hat"
  | "accessory";

export const DRAW_ORDER: WokaLayer[] = [
  "body",
  "clothes",
  "eyes",
  "hair",
  "hat",
  "accessory",
];

export type WokaOption = {
  id: string;
  label: string;
  color: string;
  url?: string;
};

export type WokaLayerDef = {
  layer: WokaLayer;
  label: string;
  optional: boolean;
  options: WokaOption[];
};

export type WokaAppearance = Record<WokaLayer, string>;

const NONE: WokaOption = { id: "none", label: "None", color: "transparent" };

function opts(
  prefix: string,
  entries: [string, string][],
): WokaOption[] {
  return entries.map(([label, color]) => ({
    id: `${prefix}-${label.toLowerCase()}`,
    label,
    color,
  }));
}

export const WOKA_LAYERS: WokaLayerDef[] = [
  {
    layer: "body",
    label: "Skin",
    optional: false,
    options: opts("body", [
      ["Light", "#f1c9a5"],
      ["Tan", "#e0ac8b"],
      ["Warm", "#c68863"],
      ["Deep", "#8d5524"],
      ["Cool", "#d8b59a"],
    ]),
  },
  {
    layer: "clothes",
    label: "Clothes",
    optional: false,
    options: opts("clothes", [
      ["Portal", "#3ee6c1"],
      ["Coin", "#ffc53d"],
      ["Rose", "#ff6b81"],
      ["Sky", "#6f9bd8"],
      ["Violet", "#9b8cff"],
      ["Moon", "#e9eaf6"],
    ]),
  },
  {
    layer: "eyes",
    label: "Eyes",
    optional: false,
    options: opts("eyes", [
      ["Dark", "#2b2b2b"],
      ["Blue", "#3a6ea5"],
      ["Green", "#2e8b57"],
      ["Amber", "#b5651d"],
    ]),
  },
  {
    layer: "hair",
    label: "Hair",
    optional: true,
    options: [
      NONE,
      ...opts("hair", [
        ["Black", "#2b2b2b"],
        ["Brown", "#5a3a1a"],
        ["Ginger", "#b5651d"],
        ["Blond", "#e8c14a"],
        ["Silver", "#c8c8d0"],
        ["Rose", "#ff6b81"],
      ]),
    ],
  },
  {
    layer: "hat",
    label: "Hat",
    optional: true,
    options: [
      NONE,
      ...opts("hat", [
        ["Cap", "#ff6b81"],
        ["Beanie", "#3ee6c1"],
        ["Night", "#14162b"],
      ]),
    ],
  },
  {
    layer: "accessory",
    label: "Extras",
    optional: true,
    options: [
      NONE,
      { id: "accessory-glasses", label: "Glasses", color: "#14162b" },
      { id: "accessory-shades", label: "Shades", color: "#0a0a0a" },
    ],
  },
];

const BY_LAYER = new Map(WOKA_LAYERS.map((l) => [l.layer, l]));

export function layerDef(layer: WokaLayer): WokaLayerDef {
  return BY_LAYER.get(layer)!;
}

export function optionOf(layer: WokaLayer, id: string): WokaOption {
  const def = layerDef(layer);
  return def.options.find((o) => o.id === id) ?? def.options[0]!;
}

export const DEFAULT_APPEARANCE: WokaAppearance = {
  body: "body-light",
  clothes: "clothes-portal",
  eyes: "eyes-dark",
  hair: "hair-brown",
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
