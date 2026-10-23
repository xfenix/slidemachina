import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export type SlideTone = "dark" | "light";

const samplingSize = 8;
const darkLuminanceLimit = 0.55;
// A picture is measured once; thumbnails and printed pages get its tone in the first frame.
const pictureTones = new Map<string, SlideTone>();

export function isBackgroundColor(backgroundValue: string): boolean {
  return CSS.supports("color", backgroundValue);
}

// A hot update of the theme or of style.css may change the slide background: the tone is measured again after it.
function useHotUpdateCount() {
  const [hotUpdateCount, setHotUpdateCount] = useState(0);
  useEffect(() => {
    const countHotUpdate = () => setHotUpdateCount((previousCount) => previousCount + 1);
    import.meta.hot?.on("vite:afterUpdate", countHotUpdate);
    return () => import.meta.hot?.off("vite:afterUpdate", countHotUpdate);
  }, []);
  return hotUpdateCount;
}

export function useBackgroundTone(
  slideElementReference: RefObject<HTMLElement | null>,
  backgroundValue: string | undefined,
  slideClassName: string | undefined,
): SlideTone {
  const [detectedTone, setDetectedTone] = useState<SlideTone>("light");
  const hotUpdateCount = useHotUpdateCount();
  useLayoutEffect(() => {
    const slideElement = slideElementReference.current;
    if (slideElement === null) return;
    const backgroundColor = getComputedStyle(slideElement).backgroundColor;
    const pictureToneKey = `${backgroundColor} ${backgroundValue}`;
    setDetectedTone(pictureTones.get(pictureToneKey) ?? measureTone(backgroundColor));
    if (backgroundValue === undefined || isBackgroundColor(backgroundValue) || pictureTones.has(pictureToneKey)) return;
    let isOutdated = false;
    const backgroundImage = new Image();
    backgroundImage.onload = () => {
      pictureTones.set(pictureToneKey, measureTone(backgroundColor, backgroundImage));
      if (!isOutdated) setDetectedTone(pictureTones.get(pictureToneKey)!);
    };
    backgroundImage.src = backgroundValue;
    return () => {
      isOutdated = true;
    };
  }, [slideElementReference, backgroundValue, slideClassName, hotUpdateCount]);
  return detectedTone;
}

function measureTone(backgroundColor: string, backgroundImage?: HTMLImageElement): SlideTone {
  const samplingCanvas = document.createElement("canvas");
  samplingCanvas.width = samplingSize;
  samplingCanvas.height = samplingSize;
  const drawingContext = samplingCanvas.getContext("2d", { willReadFrequently: true });
  if (drawingContext === null) return "light";
  drawingContext.fillStyle = backgroundColor;
  drawingContext.fillRect(0, 0, samplingSize, samplingSize);
  if (backgroundImage !== undefined) drawingContext.drawImage(backgroundImage, 0, 0, samplingSize, samplingSize);
  try {
    const pixelBytes = drawingContext.getImageData(0, 0, samplingSize, samplingSize).data;
    let luminanceTotal = 0;
    for (let byteOffset = 0; byteOffset < pixelBytes.length; byteOffset += 4) {
      luminanceTotal +=
        0.2126 * pixelBytes[byteOffset] + 0.7152 * pixelBytes[byteOffset + 1] + 0.0722 * pixelBytes[byteOffset + 2];
    }
    return luminanceTotal / (samplingSize * samplingSize) / 255 < darkLuminanceLimit ? "dark" : "light";
  } catch {
    // Images from other sites taint the canvas; keep the color-based guess.
    return backgroundImage === undefined ? "light" : measureTone(backgroundColor);
  }
}
