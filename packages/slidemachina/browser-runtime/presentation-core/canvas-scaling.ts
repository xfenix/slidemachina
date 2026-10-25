import { useEffect, useState } from "react";
import type { CanvasSize } from "../../shared-between-runtimes/canvas-size.js";

// The canvas keeps the format of the presentation: the window only scales it and leaves letterbox margins.
function measureCanvasScale({ canvasWidth, canvasHeight }: CanvasSize): number {
  return Math.min(window.innerWidth / canvasWidth, window.innerHeight / canvasHeight);
}

export function useCanvasScale(canvasSize: CanvasSize): number {
  const [canvasScale, setCanvasScale] = useState(() => measureCanvasScale(canvasSize));
  useEffect(() => {
    const remeasureCanvas = () => setCanvasScale(measureCanvasScale(canvasSize));
    remeasureCanvas();
    window.addEventListener("resize", remeasureCanvas);
    return () => window.removeEventListener("resize", remeasureCanvas);
  }, [canvasSize]);
  return canvasScale;
}
