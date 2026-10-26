import { Children, isValidElement, useRef, type CSSProperties, type ReactNode } from "react";
import { MediaFrame } from "../media-frame.tsx";
import { useCaptionFitting } from "./meme-caption-fitting.ts";
import type { MemeCaptionField, MemeTemplateLayout } from "../../../shared-between-runtimes/meme-template.js";

export type MemeProperties = {
  // The memegen template id: "drake", "fine", "jd". It lies in images/memes/<template>/ and is downloaded when missing.
  template: string;
  // The GIF version of the template, if it has one.
  animated?: boolean;
  // Captions in the order of the template's fields, one element each: <p>Top</p><p>Bottom</p>. A <figcaption> goes under the picture.
  children?: ReactNode;
  // Written by the slide source plugin from config.yml.
  memeTemplate?: MemeTemplateLayout;
};

const percentScale = 100;

function isFigureCaption(childNode: ReactNode): boolean {
  return isValidElement(childNode) && childNode.type === "figcaption";
}

// memegen rotates the field around its top-left corner and pastes the grown box there; the shift keeps CSS rotation on that spot.
function createFieldStyle(captionField: MemeCaptionField, pictureRatio: number): CSSProperties {
  const angleRadians = (captionField.fieldAngle * Math.PI) / 180;
  const fieldWidth = captionField.fieldWidth * pictureRatio;
  const fieldHeight = captionField.fieldHeight;
  const rotatedWidth = Math.abs(fieldWidth * Math.cos(angleRadians)) + Math.abs(fieldHeight * Math.sin(angleRadians));
  const rotatedHeight = Math.abs(fieldWidth * Math.sin(angleRadians)) + Math.abs(fieldHeight * Math.cos(angleRadians));
  return {
    left: `${captionField.fieldLeft * percentScale}%`,
    top: `${captionField.fieldTop * percentScale}%`,
    width: `${captionField.fieldWidth * percentScale}%`,
    height: `${captionField.fieldHeight * percentScale}%`,
    translate: `${((rotatedWidth - fieldWidth) / 2 / fieldWidth) * percentScale}% ${((rotatedHeight - fieldHeight) / 2 / fieldHeight) * percentScale}%`,
    rotate: `${-captionField.fieldAngle}deg`,
    color: captionField.textColor,
    textAlign: captionField.textAlign,
    textTransform: captionField.letterCase === "none" ? undefined : `${captionField.letterCase}case`,
  };
}

// A memegen template with the captions as live text: the editor types into them, the typographer and print treat them as text.
export function Meme({ template, children, memeTemplate }: MemeProperties) {
  const memeReference = useRef<HTMLDivElement>(null);
  useCaptionFitting(memeReference, children);
  if (memeTemplate === undefined) return null;
  const childNodes = Children.toArray(children);
  const captionNodes = childNodes.filter((childNode) => !isFigureCaption(childNode));
  const { pictureWidth, pictureHeight } = memeTemplate;
  const pictureRatio = pictureWidth / pictureHeight;
  const memeStyle = { "--media-ratio": pictureRatio, "--meme-picture-height": pictureHeight } as CSSProperties;
  return (
    <MediaFrame stretch caption={childNodes.filter(isFigureCaption)}>
      <div ref={memeReference} data-media data-meme={template} style={memeStyle}>
        <img src={memeTemplate.pictureAddress} alt={memeTemplate.templateName} />
        {memeTemplate.captionFields.map((captionField, fieldIndex) => (
          <div
            key={fieldIndex}
            data-meme-field
            data-meme-font={captionField.isThickFont ? "thick" : "thin"}
            data-meme-angled={captionField.fieldAngle === 0 ? undefined : ""}
            data-meme-outline={captionField.textColor === "black" ? undefined : ""}
            style={createFieldStyle(captionField, pictureRatio)}
          >
            {captionNodes[fieldIndex]}
          </div>
        ))}
      </div>
    </MediaFrame>
  );
}
