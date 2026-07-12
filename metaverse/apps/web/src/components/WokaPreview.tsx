import { useEffect, useRef } from "react";
import type { WokaAppearance } from "../game/woka/wokaConfig";
import {
  FRAME_H,
  FRAME_W,
  WALK_COLS,
  drawComposite,
  loadAppearance,
  type LoadedLayer,
} from "../game/woka/wokaRender";

export default function WokaPreview({
  appearance,
  scale = 3,
  animated = false,
  className,
}: {
  appearance: WokaAppearance;
  scale?: number;
  animated?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const paint = (loaded: LoadedLayer[], col: number) => {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawComposite(ctx, loaded, 0, col);
      ctx.restore();
    };

    loadAppearance(appearance)
      .then((loaded) => {
        if (cancelled) return;
        if (!animated) {
          paint(loaded, 1);
          return;
        }
        let i = 0;
        paint(loaded, WALK_COLS[0]!);
        timer = setInterval(() => {
          i = (i + 1) % WALK_COLS.length;
          paint(loaded, WALK_COLS[i]!);
        }, 150);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [appearance, scale, animated]);

  return (
    <canvas
      ref={canvasRef}
      width={FRAME_W * scale}
      height={FRAME_H * scale}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
