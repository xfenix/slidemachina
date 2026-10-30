import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const samplingSize = 8;
const colorChannelCount = 4;
const darkLuminanceLimit = 0.55;
const redLuminanceShare = 0.2126;
const greenLuminanceShare = 0.7152;
const blueLuminanceShare = 0.0722;
const brightestLevel = 255;
// Computed colours are mostly rgb(): they are read without a canvas, whose first use takes about 10 ms of the first frame.
const rgbColorPattern = /^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/;
// A local file ends in its extension; in a one-file build an imported video is a data: address.
const videoAddressPattern = /(\.(mp4|webm|mov|m4v|ogv)([?#].*)?$)|^data:video\//i;
// A colour or picture is measured once; thumbnails and printed pages get its tone in the first frame.
const measuredTones = new Map<string, SlideTone>();

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
    if (!measuredTones.has(backgroundColor)) measuredTones.set(backgroundColor, measureColorTone(backgroundColor));
    // oxlint-disable-next-line react/set-state-in-effect -- the tone is measured from the rendered slide
    setDetectedTone(measuredTones.get(pictureToneKey) ?? measuredTones.get(backgroundColor)!);
    if ((backgroundKind !== "picture" && backgroundKind !== "video") || measuredTones.has(pictureToneKey)) return;
    let isOutdated = false;
    const rememberTone = (sampledSource: CanvasImageSource) => {
      measuredTones.set(pictureToneKey, measureTone(backgroundColor, sampledSource));
      if (!isOutdated) setDetectedTone(measuredTones.get(pictureToneKey)!);
    };
    // A video is measured by its first frame, once the background layer has loaded it near its slide.
    const backgroundVideo = slideElement.querySelector<HTMLVideoElement>(":scope > video[data-slide-background]");
    const measureVideoFrame = () => backgroundVideo !== null && rememberTone(backgroundVideo);
    if (backgroundKind === "video") {
      if (backgroundVideo !== null && backgroundVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) measureVideoFrame();
      else backgroundVideo?.addEventListener("loadeddata", measureVideoFrame, { once: true });
    } else {
      sampleBackgroundPicture(backgroundAddress!).then(rememberTone, () => undefined);
    }
    return () => {
      isOutdated = true;
      backgroundVideo?.removeEventListener("loadeddata", measureVideoFrame);
    };
  }, [slideElementReference, backgroundAddress, backgroundKind, slideClassName, hotUpdateCount]);
  return detectedTone;
}

// A file is decoded and shrunk off the main thread; a picture from a site without CORS falls back to an <img> decoded on it.
async function sampleBackgroundPicture(pictureAddress: string): Promise<CanvasImageSource> {
  try {
    const pictureResponse = await fetch(pictureAddress, { cache: "force-cache" });
    return await createImageBitmap(await pictureResponse.blob(), { resizeWidth: samplingSize, resizeHeight: samplingSize });
  } catch {
    const backgroundImage = new Image();
    backgroundImage.src = pictureAddress;
    await backgroundImage.decode();
    return backgroundImage;
  }
}

function classifyLuminance(averageLevel: number): SlideTone {
  return averageLevel / brightestLevel < darkLuminanceLimit ? "dark" : "light";
}

function measureColorTone(backgroundColor: string): SlideTone {
  const rgbMatch = rgbColorPattern.exec(backgroundColor);
  if (rgbMatch === null) return measureTone(backgroundColor);
  // A fully transparent colour reads as black, as it does from the canvas.
  const isTransparent = rgbMatch[4] !== undefined && Number(rgbMatch[4]) === 0;
  const [redLevel, greenLevel, blueLevel] = rgbMatch.slice(1, 4).map((channelText) => (isTransparent ? 0 : Number(channelText)));
  return classifyLuminance(redLuminanceShare * redLevel! + greenLuminanceShare * greenLevel! + blueLuminanceShare * blueLevel!);
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
    return classifyLuminance(luminanceTotal / (samplingSize * samplingSize));
  } catch {
    // Images from other sites taint the canvas; keep the color-based guess.
    return backgroundImage === undefined ? "light" : measureTone(backgroundColor);
  }
}
