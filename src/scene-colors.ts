import { Color, SRGBColorSpace } from "three";

const colorSamplingContext = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true })!;

// Any CSS colour works: a probe in the slide resolves it in the slide tone, a 1×1 canvas turns it into sRGB.
export function resolveSceneColor(probeElement: HTMLElement, cssColor: string): Color {
  probeElement.style.color = "";
  probeElement.style.color = cssColor;
  colorSamplingContext.clearRect(0, 0, 1, 1);
  colorSamplingContext.fillStyle = getComputedStyle(probeElement).color;
  colorSamplingContext.fillRect(0, 0, 1, 1);
  const [redLevel, greenLevel, blueLevel] = colorSamplingContext.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB(redLevel / 255, greenLevel / 255, blueLevel / 255, SRGBColorSpace);
}

export function readSceneNumber(figureElement: HTMLElement, propertyName: string, fallbackNumber: number): number {
  const propertyNumber = Number.parseFloat(getComputedStyle(figureElement).getPropertyValue(propertyName));
  return Number.isFinite(propertyNumber) ? propertyNumber : fallbackNumber;
}
