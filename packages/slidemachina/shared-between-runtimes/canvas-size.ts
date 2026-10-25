// The page sizes the slide canvas, the build sizes covers by it: both read <Presentation aspectRatio>.
export type AspectRatio = `${number}:${number}`;
export type CanvasSize = { canvasWidth: number; canvasHeight: number };

export const defaultAspectRatio: AspectRatio = "16:9";
// The shorter side keeps font sizes and the frame grid the same in any format, a vertical one included.
export const canvasShorterSide = 1080;

// "4:3" gives 1440×1080, "9:16" gives 1080×1920; anything but two finite positive numbers gives undefined.
export function measureCanvasSize(aspectRatioText: string): CanvasSize | undefined {
  const ratioParts = aspectRatioText.split(":");
  if (ratioParts.length !== 2 || ratioParts.some((ratioPart) => ratioPart.trim() === "")) return undefined;
  const [ratioWidth, ratioHeight] = ratioParts.map(Number) as [number, number];
  if (![ratioWidth, ratioHeight].every((ratioNumber) => Number.isFinite(ratioNumber) && ratioNumber > 0)) return undefined;
  return ratioWidth >= ratioHeight
    ? { canvasWidth: Math.round((canvasShorterSide * ratioWidth) / ratioHeight), canvasHeight: canvasShorterSide }
    : { canvasWidth: canvasShorterSide, canvasHeight: Math.round((canvasShorterSide * ratioHeight) / ratioWidth) };
}
