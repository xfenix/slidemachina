import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { readLargestAnisotropy } from "./scene-renderer.ts";

const preferredFontPixels = 256;
const largestTexturePixels = 4096;

type TextLook = {
  fontFamily: string;
  fontWeight: string;
};

function prepareTextContext(textContext: OffscreenCanvasRenderingContext2D, fontPixels: number, textLook: TextLook) {
  textContext.font = `${textLook.fontWeight} ${fontPixels}px ${textLook.fontFamily}`;
  textContext.letterSpacing = "-0.02em";
  textContext.fillStyle = "#ffffff";
}

// The browser draws the text in the slide font; white letters let the material colour tint them.
export function createTextMesh(textContent: string, letterSize: number, textLook: TextLook): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const measuringContext = new OffscreenCanvas(1, 1).getContext("2d")!;
  prepareTextContext(measuringContext, preferredFontPixels, textLook);
  const preferredWidth = measuringContext.measureText(textContent).width * 1.2;
  const fontPixels = Math.floor(preferredFontPixels * Math.min(1, largestTexturePixels / Math.max(preferredWidth, 1)));
  prepareTextContext(measuringContext, fontPixels, textLook);
  const textMetrics = measuringContext.measureText(textContent);
  const textPadding = Math.ceil(fontPixels * 0.1);
  const textureWidth = Math.ceil(textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight) + 2 * textPadding;
  const textureHeight = Math.ceil(textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent) + 2 * textPadding;

  const textCanvas = new OffscreenCanvas(Math.max(textureWidth, 1), textureHeight);
  const textContext = textCanvas.getContext("2d")!;
  prepareTextContext(textContext, fontPixels, textLook);
  textContext.fillText(textContent, textPadding + textMetrics.actualBoundingBoxLeft, textPadding + textMetrics.fontBoundingBoxAscent);

  const textTexture = new CanvasTexture(textCanvas);
  textTexture.colorSpace = SRGBColorSpace;
  // Premultiplied edges keep mipmaps from mixing in the black of empty pixels.
  textTexture.premultiplyAlpha = true;
  textTexture.anisotropy = readLargestAnisotropy();
  const textMaterial = new MeshBasicMaterial({ map: textTexture, transparent: true, premultipliedAlpha: true, toneMapped: false, depthWrite: false });
  const planeGeometry = new PlaneGeometry((letterSize * textCanvas.width) / fontPixels, (letterSize * textCanvas.height) / fontPixels);
  return new Mesh(planeGeometry, textMaterial);
}
