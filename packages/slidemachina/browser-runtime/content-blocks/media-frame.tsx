import type { ReactNode } from "react";

export type MediaFit = "contain" | "cover";

export type MediaPlacement = {
  stretch?: boolean;
  full?: boolean;
  fit?: MediaFit;
};

// The frame sizes the picture by its proportions, so rounded corners and the shadow hug the picture itself.
export function rememberProportions(mediaElement: HTMLElement, mediaWidth: number, mediaHeight: number) {
  if (mediaWidth > 0 && mediaHeight > 0) mediaElement.style.setProperty("--media-ratio", String(mediaWidth / mediaHeight));
}

// stretch takes the free space under the heading, like r-stretch in reveal.js; full covers the whole slide.
// A <Caption> inside the media goes into one group with it: under the picture, from its left edge.
export function MediaFrame({ stretch = false, full = false, fit, caption, children }: MediaPlacement & { caption?: ReactNode; children: ReactNode }) {
  if (!stretch && !full) {
    return (
      <>
        {children}
        {caption}
      </>
    );
  }
  return (
    <>
      <div data-media-frame={full ? "full" : "stretch"} data-media-fit={fit ?? (full ? "cover" : "contain")}>
        {full ? (
          children
        ) : (
          <div data-media-group>
            {children}
            {caption}
          </div>
        )}
      </div>
      {full && caption}
    </>
  );
}
