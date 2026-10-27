import { Children, isValidElement, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { MediaFrame, rememberProportions } from "../media-frame.tsx";
import { useCaptionFitting } from "./meme-caption-fitting.ts";
import type { ImageFloat } from "../image-component.tsx";

export type MemeProperties = {
  src: string;
  alt?: string;
  // By default the meme takes the free space, as <Image stretch>; float or stretch={false} keep it at its own size.
  stretch?: boolean;
  float?: ImageFloat;
  // Captions, one element each: <p>Top</p><p>Bottom</p>. data-place="top", "bottom", "center" or "left top width height" in percent moves one.
  // Colour, turn, case and weight are plain CSS on the caption: style={{ color: "black", rotate: "-8deg" }}. A <figcaption> goes under the picture.
  children?: ReactNode;
};
type CaptionBox = { boxLeft: number; boxTop: number; boxWidth: number; boxHeight: number };

// memegen's default fields: a band of a fifth of the picture along the top, then along the bottom; more captions go to the middle.
const namedCaptionBoxes: Record<string, CaptionBox> = {
  top: { boxLeft: 0, boxTop: 0, boxWidth: 100, boxHeight: 20 },
  bottom: { boxLeft: 0, boxTop: 80, boxWidth: 100, boxHeight: 20 },
  center: { boxLeft: 0, boxTop: 40, boxWidth: 100, boxHeight: 20 },
};
const defaultPlaces = ["top", "bottom"];
const boxNumberCount = 4;

function isFigureCaption(childNode: ReactNode): boolean {
  return isValidElement(childNode) && childNode.type === "figcaption";
}

function readCaptionPlace(captionNode: ReactNode, captionIndex: number): string {
  const writtenPlace = isValidElement<{ "data-place"?: string }>(captionNode) ? captionNode.props["data-place"] : undefined;
  return writtenPlace ?? defaultPlaces[captionIndex] ?? "center";
}

// "50 0 50 50" or "50% 0 50% 50%": left, top, width and height in percent of the picture.
function resolveCaptionBox(captionPlace: string): CaptionBox {
  const namedBox = namedCaptionBoxes[captionPlace];
  if (namedBox !== undefined) return namedBox;
  const boxNumbers = captionPlace.split(/\s+/).map((boxPart) => Number.parseFloat(boxPart));
  if (boxNumbers.length !== boxNumberCount || boxNumbers.some((boxNumber) => !Number.isFinite(boxNumber))) return namedCaptionBoxes.center!;
  const [boxLeft, boxTop, boxWidth, boxHeight] = boxNumbers as [number, number, number, number];
  return { boxLeft, boxTop, boxWidth, boxHeight };
}

// A picture with the captions as live text: the editor types into them, the typographer and print treat them as text.
export function Meme({ src, alt = "", stretch, float, children }: MemeProperties) {
  const memeReference = useRef<HTMLDivElement>(null);
  useCaptionFitting(memeReference, children);
  const childNodes = Children.toArray(children);
  const captionNodes = childNodes.filter((childNode) => !isFigureCaption(childNode));
  const isStretched = stretch ?? float === undefined;
  // The meme takes the proportions of its picture, and the captions their limits from its height in pixels of the picture.
  useLayoutEffect(() => {
    const memeElement = memeReference.current;
    const pictureElement = memeElement?.querySelector("img");
    if (memeElement == null || pictureElement == null) return;
    const rememberPictureSize = () => {
      rememberProportions(memeElement, pictureElement.naturalWidth, pictureElement.naturalHeight);
      memeElement.style.setProperty("--meme-picture-width", String(pictureElement.naturalWidth));
      memeElement.style.setProperty("--meme-picture-height", String(pictureElement.naturalHeight));
      memeElement.dispatchEvent(new Event("input"));
    };
    if (pictureElement.complete && pictureElement.naturalWidth > 0) rememberPictureSize();
    pictureElement.addEventListener("load", rememberPictureSize);
    return () => pictureElement.removeEventListener("load", rememberPictureSize);
  }, [src]);
  return (
    <MediaFrame stretch={isStretched} caption={childNodes.filter(isFigureCaption)}>
      <div ref={memeReference} data-media data-meme data-media-float={float}>
        <img src={src} alt={alt} />
        {captionNodes.map((captionNode, captionIndex) => {
          const { boxLeft, boxTop, boxWidth, boxHeight } = resolveCaptionBox(readCaptionPlace(captionNode, captionIndex));
          const fieldStyle: CSSProperties = { left: `${boxLeft}%`, top: `${boxTop}%`, width: `${boxWidth}%`, height: `${boxHeight}%` };
          return (
            <div key={captionIndex} data-meme-field style={fieldStyle}>
              {captionNode}
            </div>
          );
        })}
      </div>
    </MediaFrame>
  );
}
