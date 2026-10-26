import type { Locator } from "@playwright/test";

// A small copy of a scene canvas: how many pixels differ from its corner, the empty or printed background colour,
// and a fingerprint that changes when the frame moves.
export function sampleSceneCanvas(sceneCanvas: Locator) {
  return sceneCanvas.evaluate((canvasElement: HTMLCanvasElement) => {
    const sampleCanvas = document.createElement("canvas");
    Object.assign(sampleCanvas, { width: 96, height: 54 });
    const sampleContext = sampleCanvas.getContext("2d")!;
    sampleContext.drawImage(canvasElement, 0, 0, 96, 54);
    const samplePixels = sampleContext.getImageData(0, 0, 96, 54).data;
    let paintedPixels = 0;
    for (let pixelIndex = 0; pixelIndex < samplePixels.length; pixelIndex += 4) {
      if ([0, 1, 2, 3].some((channelIndex) => samplePixels[pixelIndex + channelIndex] !== samplePixels[channelIndex])) paintedPixels += 1;
    }
    return { paintedPixels, frameFingerprint: samplePixels.join(",") };
  });
}
