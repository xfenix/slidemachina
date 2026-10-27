import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const samplingSize = 8;
const colorChannelCount = 4;
const darkLuminanceLimit = 0.55;
const redLuminanceShare = 0.2126;
const greenLuminanceShare = 0.7152;
const blueLuminanceShare = 0.0722;
const brightestLevel = 255;
// A local file ends in its extension; in a one-file build an imported video is a data: address.
const videoAddressPattern = /(\.(mp4|webm|mov|m4v|ogv)([?#].*)?$)|^data:video\//i;
// A picture is measured once; thumbnails and printed pages get its tone in the first frame.
const pictureTones = new Map<string, SlideTone>();

export type SlideTone = "dark" | "light";
// A colour, a picture or GIF, a video file, or a web page under the slide: background={{ iframe: "https://…" }}.
export type SlideBackgroundValue = string | { iframe: string };
export type SlideBackgroundKind = "color" | "picture" | "video" | "iframe";

export function isBackgroundColor(backgroundValue: string): boolean {
  return CSS.supports("color", backgroundValue);
}

export function classifySlideBackground(backgroundValue: SlideBackgroundValue): SlideBackgroundKind {
  if (typeof backgroundValue !== "string") return "iframe";
  if (isBackgroundColor(backgroundValue)) return "color";
  return videoAddressPattern.test(backgroundValue) ? "video" : "picture";
}

export function readBackgroundAddress(backgroundValue: SlideBackgroundValue | undefined): string | undefined {
  return typeof backgroundValue === "object" ? backgroundValue.iframe : backgroundValue;
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

// A page cannot be measured: its slide keeps the tone of the slide colour unless tone is set.
export function useBackgroundTone(
  slideElementReference: RefObject<HTMLElement | null>,
  backgroundValue: SlideBackgroundValue | undefined,
  slideClassName: string | undefined,
): SlideTone {
  const [detectedTone, setDetectedTone] = useState<SlideTone>("light");
  const hotUpdateCount = useHotUpdateCount();
  const backgroundAddress = readBackgroundAddress(backgroundValue);
  const backgroundKind = backgroundValue === undefined ? undefined : classifySlideBackground(backgroundValue);
  useLayoutEffect(() => {
    const slideElement = slideElementReference.current;
    if (slideElement === null) return;
    const backgroundColor = getComputedStyle(slideElement).backgroundColor;
    const pictureToneKey = `${backgroundColor} ${backgroundAddress}`;
    // oxlint-disable-next-line react/set-state-in-effect -- the tone is measured from the rendered slide
    setDetectedTone(pictureTones.get(pictureToneKey) ?? measureTone(backgroundColor));
    if ((backgroundKind !== "picture" && backgroundKind !== "video") || pictureTones.has(pictureToneKey)) return;
    let isOutdated = false;
    const rememberTone = (sampledSource: CanvasImageSource) => {
      pictureTones.set(pictureToneKey, measureTone(backgroundColor, sampledSource));
      if (!isOutdated) setDetectedTone(pictureTones.get(pictureToneKey)!);
    };
    // A video is measured by its first frame, once the background layer has loaded it near its slide.
    const backgroundVideo = slideElement.querySelector<HTMLVideoElement>(":scope > video[data-slide-background]");
    const measureVideoFrame = () => backgroundVideo !== null && rememberTone(backgroundVideo);
    if (backgroundKind === "video") {
      if (backgroundVideo !== null && backgroundVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) measureVideoFrame();
      else backgroundVideo?.addEventListener("loadeddata", measureVideoFrame, { once: true });
    } else {
      const backgroundImage = new Image();
      backgroundImage.onload = () => rememberTone(backgroundImage);
      backgroundImage.src = backgroundAddress!;
    }
    return () => {
      isOutdated = true;
      backgroundVideo?.removeEventListener("loadeddata", measureVideoFrame);
    };
  }, [slideElementReference, backgroundAddress, backgroundKind, slideClassName, hotUpdateCount]);
  return detectedTone;
}

function measureTone(backgroundColor: string, backgroundImage?: CanvasImageSource): SlideTone {
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
    for (let byteOffset = 0; byteOffset < pixelBytes.length; byteOffset += colorChannelCount) {
      luminanceTotal +=
        redLuminanceShare * pixelBytes[byteOffset]! +
        greenLuminanceShare * pixelBytes[byteOffset + 1]! +
        blueLuminanceShare * pixelBytes[byteOffset + 2]!;
    }
    return luminanceTotal / (samplingSize * samplingSize) / brightestLevel < darkLuminanceLimit ? "dark" : "light";
  } catch {
    // Images from other sites taint the canvas; keep the color-based guess.
    return backgroundImage === undefined ? "light" : measureTone(backgroundColor);
  }
}
