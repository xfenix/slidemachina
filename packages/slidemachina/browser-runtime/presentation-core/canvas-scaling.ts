import { useEffect, useState } from "react";
import type { CanvasSize } from "../../shared-between-runtimes/canvas-size.js";

// The toolbar moves under the canvas when the margin there fits it with a gap on both sides.
const toolbarRoomHeight = 76;

type CanvasLayout = { canvasScale: number; hasRoomUnderCanvas: boolean };

// The canvas keeps the format of the presentation: the window only scales it and leaves letterbox margins.
function measureCanvasLayout({ canvasWidth, canvasHeight }: CanvasSize): CanvasLayout {
  const canvasScale = Math.min(window.innerWidth / canvasWidth, window.innerHeight / canvasHeight);
  const letterboxHeight = (window.innerHeight - canvasHeight * canvasScale) / 2;
  return { canvasScale, hasRoomUnderCanvas: letterboxHeight >= toolbarRoomHeight };
}

export function useCanvasLayout(canvasSize: CanvasSize): CanvasLayout {
  const [canvasLayout, setCanvasLayout] = useState(() => measureCanvasLayout(canvasSize));
  useEffect(() => {
    const remeasureCanvas = () => {
      const measuredLayout = measureCanvasLayout(canvasSize);
      setCanvasLayout((previousLayout) =>
        previousLayout.canvasScale === measuredLayout.canvasScale && previousLayout.hasRoomUnderCanvas === measuredLayout.hasRoomUnderCanvas ? previousLayout : measuredLayout,
      );
    };
    remeasureCanvas();
    window.addEventListener("resize", remeasureCanvas);
    return () => window.removeEventListener("resize", remeasureCanvas);
  }, [canvasSize]);
  return canvasLayout;
}
