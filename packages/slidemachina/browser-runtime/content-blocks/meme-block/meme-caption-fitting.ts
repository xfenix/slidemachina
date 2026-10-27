import { useLayoutEffect, type RefObject } from "react";

// memegen's own limits: a caption is at most a ninth of the picture high, a quarter when the field is turned.
const largestFlatFontShare = 1 / 9;
const largestAngledFontShare = 1 / 4;
// The text keeps a tenth of the field height free, as memegen does; its width margin is in the CSS.
const usedHeightShare = 0.9;
const smallestFontSize = 8;
const fittingSteps = 10;
// memegen outlines letters with a twelfth of the font size, from 1 to 3 pixels of the picture; CSS strokes half of it inside the letter.
const outlineFontShare = 1 / 12;
const thinnestPictureOutline = 1;
const thickestPictureOutline = 3;
const strokeToOutlineRatio = 2;
// Black captions go without an outline, as in memegen: the colour is plain CSS on the caption, so it is read from the page.
const darkestOutlinedLuminance = 0.2;
const redLuminanceShare = 0.2126;
const greenLuminanceShare = 0.7152;
const blueLuminanceShare = 0.0722;
const brightestLevel = 255;

function isDarkColor(colorValue: string): boolean {
  const colorChannels = colorValue.match(/[\d.]+/g)?.map(Number) ?? [];
  const [redChannel = brightestLevel, greenChannel = brightestLevel, blueChannel = brightestLevel] = colorChannels;
  const relativeLuminance = (redLuminanceShare * redChannel + greenLuminanceShare * greenChannel + blueLuminanceShare * blueChannel) / brightestLevel;
  return relativeLuminance < darkestOutlinedLuminance;
}

function fitCaption(fieldElement: HTMLElement, memeHeight: number, pictureScale: number) {
  const captionElement = fieldElement.firstElementChild;
  if (!(captionElement instanceof HTMLElement)) return;
  const captionStyle = getComputedStyle(captionElement);
  fieldElement.toggleAttribute("data-meme-outline", !isDarkColor(captionStyle.color));
  const isAngled = captionStyle.rotate !== "none" && captionStyle.rotate !== "0deg";
  const largestFontSize = memeHeight * (isAngled ? largestAngledFontShare : largestFlatFontShare);
  const roomHeight = fieldElement.clientHeight * usedHeightShare;
  const fitsAt = (fontSize: number) => {
    fieldElement.style.fontSize = `${fontSize}px`;
    return captionElement.scrollWidth <= captionElement.clientWidth && captionElement.offsetHeight <= roomHeight;
  };
  let fittingSize = smallestFontSize;
  let overflowingSize = largestFontSize;
  if (fitsAt(largestFontSize)) fittingSize = largestFontSize;
  else {
    for (let fittingStep = 0; fittingStep < fittingSteps; fittingStep += 1) {
      const middleSize = (fittingSize + overflowingSize) / 2;
      if (fitsAt(middleSize)) fittingSize = middleSize;
      else overflowingSize = middleSize;
    }
  }
  fieldElement.style.fontSize = `${fittingSize}px`;
  const pictureOutline = Math.min(thickestPictureOutline, Math.max(thinnestPictureOutline, (fittingSize / pictureScale) * outlineFontShare));
  fieldElement.style.setProperty("--meme-outline-width", `${pictureOutline * pictureScale * strokeToOutlineRatio}px`);
}

function fitMemeCaptions(memeElement: HTMLElement) {
  const memeHeight = memeElement.clientHeight;
  const pictureHeight = Number(memeElement.style.getPropertyValue("--meme-picture-height"));
  if (memeHeight === 0 || !(pictureHeight > 0)) return;
  for (const fieldElement of memeElement.querySelectorAll<HTMLElement>("[data-meme-field]")) fitCaption(fieldElement, memeHeight, memeHeight / pictureHeight);
}

// Each caption gets the largest font that fits its field, again while it is typed in the editor and once the font arrives.
export function useCaptionFitting(memeReference: RefObject<HTMLElement | null>, captionContent: unknown) {
  useLayoutEffect(() => {
    const memeElement = memeReference.current;
    if (memeElement === null) return;
    const refitCaptions = () => fitMemeCaptions(memeElement);
    const sizeObserver = new ResizeObserver(refitCaptions);
    sizeObserver.observe(memeElement);
    memeElement.addEventListener("input", refitCaptions);
    document.fonts.addEventListener("loadingdone", refitCaptions);
    void document.fonts.ready.then(refitCaptions);
    refitCaptions();
    return () => {
      sizeObserver.disconnect();
      memeElement.removeEventListener("input", refitCaptions);
      document.fonts.removeEventListener("loadingdone", refitCaptions);
    };
  }, [memeReference, captionContent]);
}
