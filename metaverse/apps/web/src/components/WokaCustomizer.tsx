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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal woka-modal"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave} disabled={busy}>
            {busy ? "Saving..." : "Save avatar"}
          </button>
        </div>
        <h2 style={{ fontSize: "0.95rem", color: "var(--coin)" }}>
          your avatar
        </h2>

        <div className="woka-editor">
          <div className="woka-stage">
            <WokaPreview appearance={appearance} scale={4} animated />
            <button
              className="btn ghost"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
              onClick={() => setAppearance(randomAppearance())}
            >
              🎲 Randomize
            </button>
          </div>

          <div className="woka-controls">
            <div className="woka-tabs">
              {WOKA_LAYERS.map((l) => (
                <button
                  key={l.layer}
                  className={activeLayer === l.layer ? "active" : ""}
                  onClick={() => setActiveLayer(l.layer)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="woka-swatches">
              {active.options.map((opt, i) => (
                <button
                  key={opt.id}
                  className={`woka-swatch${appearance[activeLayer] === opt.id ? " selected" : ""}`}
                  title={opt.label}
                  onClick={() => set(activeLayer, opt.id)}
                >
                  <span className="woka-chip">
                    {opt.id === "none" ? (
                      <span className="woka-none">∅</span>
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
                  <span className="woka-swatch-label">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
