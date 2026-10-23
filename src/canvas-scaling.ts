import { useEffect, useState } from "react";

const canvasHeight = 1080;
const narrowestAspectRatio = 4 / 3;
const widestAspectRatio = 21 / 9;

type CanvasMeasurement = {
  canvasWidth: number;
  canvasScale: number;
};

// Height is always 1080 logical pixels; width follows the screen within 4:3…21:9.
function measureCanvas(): CanvasMeasurement {
  const viewportAspectRatio = window.innerWidth / window.innerHeight;
  const canvasAspectRatio = Math.min(Math.max(viewportAspectRatio, narrowestAspectRatio), widestAspectRatio);
  const canvasWidth = Math.round(canvasHeight * canvasAspectRatio);
  const canvasScale = Math.min(window.innerWidth / canvasWidth, window.innerHeight / canvasHeight);
  return { canvasWidth, canvasScale };
}

export function useCanvasScaling(): CanvasMeasurement {
  const [canvasMeasurement, setCanvasMeasurement] = useState(measureCanvas);
  useEffect(() => {
    const remeasureCanvas = () => setCanvasMeasurement(measureCanvas());
    window.addEventListener("resize", remeasureCanvas);
    return () => window.removeEventListener("resize", remeasureCanvas);
  }, []);
  return canvasMeasurement;
}
