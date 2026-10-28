import { useEffect, useState } from "react";
import type { CanvasSize } from "../../shared-between-runtimes/canvas-size.js";

// The toolbar moves under the canvas when the margin there fits it with a gap on both sides.
const toolbarRoomHeight = 76;
// A 16:9 canvas grows up to 21:9 in a wide window and to 4:3 in a tall one; a phone held upright still gets margins.
const largestCanvasGrowth = 4 / 3;
// Fitters refit on the next frame or two after a resize; this pause covers them with room to spare.
const resizeSettlingPause = 500;

type CanvasLayout = CanvasSize & { canvasScale: number; hasRoomUnderCanvas: boolean };

// The format fits the window, and the canvas grows along the spare side: backgrounds and blocks at the edge reach the window edge.
// Thumbnails, covers and printed pages keep the format itself.
function measureCanvasLayout({ canvasWidth: formatWidth, canvasHeight: formatHeight }: CanvasSize): CanvasLayout {
  const canvasScale = Math.min(window.innerWidth / formatWidth, window.innerHeight / formatHeight);
  const canvasWidth = Math.min(Math.round(window.innerWidth / canvasScale), Math.round(formatWidth * largestCanvasGrowth));
  const canvasHeight = Math.min(Math.round(window.innerHeight / canvasScale), Math.round(formatHeight * largestCanvasGrowth));
  const letterboxHeight = (window.innerHeight - canvasHeight * canvasScale) / 2;
  return { canvasScale, canvasWidth, canvasHeight, hasRoomUnderCanvas: letterboxHeight >= toolbarRoomHeight };
}

function isSameLayout(previousLayout: CanvasLayout, measuredLayout: CanvasLayout): boolean {
  return (
    previousLayout.canvasScale === measuredLayout.canvasScale &&
    previousLayout.canvasWidth === measuredLayout.canvasWidth &&
    previousLayout.canvasHeight === measuredLayout.canvasHeight &&
    previousLayout.hasRoomUnderCanvas === measuredLayout.hasRoomUnderCanvas
  );
}

export function useCanvasLayout(formatSize: CanvasSize): CanvasLayout {
  const [canvasLayout, setCanvasLayout] = useState(() => measureCanvasLayout(formatSize));
  useEffect(() => {
    const remeasureCanvas = () => {
      const measuredLayout = measureCanvasLayout(formatSize);
      setCanvasLayout((previousLayout) => (isSameLayout(previousLayout, measuredLayout) ? previousLayout : measuredLayout));
    };
    remeasureCanvas();
    window.addEventListener("resize", remeasureCanvas);
    return () => window.removeEventListener("resize", remeasureCanvas);
  }, [formatSize]);
  return canvasLayout;
}

// Distant slides skip layout, so their resize observers stay silent: for a moment after the canvas changes size
// every slide is laid out again, and big numbers, code and diagrams fit the new room before they come on screen.
export function useCanvasResizing({ canvasWidth, canvasHeight }: CanvasSize): boolean {
  const currentSize = `${canvasWidth}×${canvasHeight}`;
  const [settledSize, setSettledSize] = useState(currentSize);
  useEffect(() => {
    if (currentSize === settledSize) return;
    const settlingTimer = setTimeout(() => setSettledSize(currentSize), resizeSettlingPause);
    return () => clearTimeout(settlingTimer);
  }, [currentSize, settledSize]);
  return currentSize !== settledSize;
}
