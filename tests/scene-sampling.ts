import type { Locator } from "@playwright/test";

// A small copy of a scene canvas: how many pixels differ from its corner, the empty or printed background colour,
// and a fingerprint that changes when the frame moves. The copy is taken in an animation frame, right after the scene
// has drawn it: a WebGL canvas that does not keep its drawing buffer reads as empty from any other task.
export function sampleSceneCanvas(sceneCanvas: Locator) {
  return sceneCanvas.evaluate(async (canvasElement: HTMLCanvasElement) => {
    await new Promise(requestAnimationFrame);
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
