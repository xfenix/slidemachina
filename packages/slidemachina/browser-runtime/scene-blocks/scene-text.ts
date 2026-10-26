import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { readLargestAnisotropy } from "./scene-renderer.ts";

const preferredFontPixels = 256;
const largestTexturePixels = 4096;
// Measured with headroom, so a longer text never needs a smaller font than measured.
const widthHeadroom = 1.2;
const textPaddingShare = 0.1;

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
  const preferredWidth = measuringContext.measureText(textContent).width * widthHeadroom;
  const fontPixels = Math.floor(preferredFontPixels * Math.min(1, largestTexturePixels / Math.max(preferredWidth, 1)));
  prepareTextContext(measuringContext, fontPixels, textLook);
  const textMetrics = measuringContext.measureText(textContent);
  const textPadding = Math.ceil(fontPixels * textPaddingShare);
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
  const sceneUnitsPerPixel = letterSize / fontPixels;
  const planeGeometry = new PlaneGeometry(textCanvas.width * sceneUnitsPerPixel, textCanvas.height * sceneUnitsPerPixel);
  // The camera frames the letters, not the padding and the line height around them.
  const glyphWidth = textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight;
  const glyphHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;
  const glyphMiddleY = textCanvas.height / 2 - (textPadding + textMetrics.fontBoundingBoxAscent - textMetrics.actualBoundingBoxAscent + glyphHeight / 2);
  planeGeometry.userData.outlineGeometry = new PlaneGeometry(glyphWidth * sceneUnitsPerPixel, glyphHeight * sceneUnitsPerPixel).translate(0, glyphMiddleY * sceneUnitsPerPixel, 0);
  return new Mesh(planeGeometry, textMaterial);
}
