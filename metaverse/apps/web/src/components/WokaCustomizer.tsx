import { useState } from "react";
import WokaPreview from "./WokaPreview";
import {
  DEFAULT_APPEARANCE,
  WOKA_LAYERS,
  normalizeAppearance,
  randomAppearance,
  type WokaAppearance,
  type WokaLayer,
} from "../game/woka/wokaConfig";
import {
  button,
  cx,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
} from "../lib/ui";

export default function WokaCustomizer({
  initial,
  onClose,
  onSave,
}: {
  initial: WokaAppearance;
  onClose: () => void;
  onSave: (appearance: WokaAppearance) => Promise<void> | void;
}) {
  const [appearance, setAppearance] = useState<WokaAppearance>(() =>
    normalizeAppearance(initial),
  );
  const [activeLayer, setActiveLayer] = useState<WokaLayer>("body");
  const [busy, setBusy] = useState(false);

  const active = WOKA_LAYERS.find((l) => l.layer === activeLayer)!;

  function set(layer: WokaLayer, optionId: string) {
    setAppearance((prev) => ({ ...prev, [layer]: optionId }));
  }

  async function handleSave() {
    setBusy(true);
    try {
      await onSave(appearance);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={modalBackdropClass} onClick={onClose}>
      <div
        className={`${modalPanelClass} max-w-[680px]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="woka-title"
      >
        <div className={`${modalActionsClass} mt-0 mb-4`}>
          <button className={button.ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={button.primary}
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? "Saving..." : "Save avatar"}
          </button>
        </div>
        <h2 id="woka-title" className="font-pixel text-[0.95rem] text-coin">
          your avatar
        </h2>

        <div className="mt-3 mb-2 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5">
          <div className="flex flex-col items-center gap-2.5 rounded-xl border border-line bg-midnight px-2 py-4">
            <WokaPreview appearance={appearance} scale={4} animated />
            <button
              className={`${button.ghost} min-h-8 px-2.5 py-1.5 text-xs`}
              onClick={() => setAppearance(randomAppearance())}
            >
              🎲 Randomize
            </button>
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
              {WOKA_LAYERS.map((l) => (
                <button
                  key={l.layer}
                  className={cx(
                    "min-h-8 shrink-0 rounded-md border border-line-strong bg-transparent px-2.5 py-1.5 font-pixel text-[0.6rem] text-fog transition-colors hover:border-fog focus-visible:outline-2 focus-visible:outline-portal",
                    activeLayer === l.layer &&
                      "border-coin-deep bg-dusk-raised text-coin",
                  )}
                  onClick={() => setActiveLayer(l.layer)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="grid max-h-[42dvh] grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 overflow-y-auto pr-1 sm:max-h-[50dvh]">
              {active.options.map((opt, i) => (
                <button
                  key={opt.id}
                  className={cx(
                    "flex min-w-0 flex-col items-center gap-1 rounded-lg border-2 border-line bg-midnight px-1 py-2 transition-[transform,border-color] duration-150 ease-out-snappy hover:border-fog active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-portal",
                    appearance[activeLayer] === opt.id && "border-coin",
                  )}
                  title={opt.label}
                  onClick={() => set(activeLayer, opt.id)}
                >
                  <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#20233f_0%_25%,#191b30_0%_50%)] bg-[length:12px_12px]">
                    {opt.id === "none" ? (
                      <span className="text-lg text-fog">∅</span>
                    ) : (
                      <WokaPreview
                        appearance={{
                          ...DEFAULT_APPEARANCE,
                          [activeLayer]: opt.id,
                        }}
                        scale={1.5}
                      />
                    )}
                  </span>
                  <span
                    className={cx(
                      "text-[0.68rem] text-fog",
                      appearance[activeLayer] === opt.id && "text-coin",
                    )}
                  >
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
