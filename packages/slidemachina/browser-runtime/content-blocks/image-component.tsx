import type { ReactNode } from "react";
import { pickSourceMarks } from "../presentation-core/source-marks.ts";
import { MediaFrame, rememberProportions, type MediaPlacement } from "./media-frame.tsx";

export type ImageProperties = MediaPlacement & {
  src: string;
  alt?: string;
  // A <figcaption> here stays with the picture: under it and from its left edge.
  children?: ReactNode;
};

export function Image({ src, alt = "", stretch, full, fit, children, ...otherProperties }: ImageProperties) {
  return (
    <MediaFrame stretch={stretch} full={full} fit={fit} caption={children}>
      <img
        data-media
        {...pickSourceMarks(otherProperties)}
        src={src}
        alt={alt}
        // A cached picture is complete at once: printed pages get their proportions before the print is laid out.
        ref={(pictureElement) => {
          if (pictureElement?.complete) rememberProportions(pictureElement, pictureElement.naturalWidth, pictureElement.naturalHeight);
        }}
        onLoad={(loadEvent) =>
          rememberProportions(loadEvent.currentTarget, loadEvent.currentTarget.naturalWidth, loadEvent.currentTarget.naturalHeight)
        }
      />
    </MediaFrame>
  );
}
