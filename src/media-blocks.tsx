import { useEffect, useRef, type ReactNode } from "react";
import { useSlideEnvironment } from "./slide-environment.ts";
import { pickSourceMarks } from "./source-marks.ts";

export type MediaFit = "contain" | "cover";

type MediaPlacement = {
  stretch?: boolean;
  full?: boolean;
  fit?: MediaFit;
};

export type ImageProperties = MediaPlacement & {
  src: string;
  alt?: string;
};

export type VideoProperties = MediaPlacement & {
  src: string;
  poster?: string;
  loop?: boolean;
  controls?: boolean;
};

// The frame sizes the picture by its proportions, so rounded corners and the shadow hug the picture itself.
function rememberProportions(mediaElement: HTMLElement, mediaWidth: number, mediaHeight: number) {
  if (mediaWidth > 0 && mediaHeight > 0) mediaElement.style.setProperty("--media-ratio", String(mediaWidth / mediaHeight));
}

// stretch takes the free space under the heading, like r-stretch in reveal.js; full covers the whole slide.
function MediaFrame({ stretch = false, full = false, fit, children }: MediaPlacement & { children: ReactNode }) {
  if (!stretch && !full) return children;
  return (
    <div data-media-frame={full ? "full" : "stretch"} data-media-fit={fit ?? (full ? "cover" : "contain")}>
      {children}
    </div>
  );
}

export function Image({ src, alt = "", stretch, full, fit, ...otherProperties }: ImageProperties) {
  return (
    <MediaFrame stretch={stretch} full={full} fit={fit}>
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

// Plays muted only while its slide is on screen and loads only near its slide.
export function Video({ src, poster, loop = true, controls = false, stretch, full, fit }: VideoProperties) {
  const videoElementReference = useRef<HTMLVideoElement>(null);
  const { isCurrentSlide, isSlideNearby, isSlideCopy } = useSlideEnvironment();
  const loadsVideo = isSlideNearby || (isSlideCopy && poster === undefined);

  useEffect(() => {
    const videoElement = videoElementReference.current;
    if (videoElement === null) return;
    if (isCurrentSlide) void videoElement.play().catch(() => {});
    else videoElement.pause();
  }, [isCurrentSlide]);

  return (
    <MediaFrame stretch={stretch} full={full} fit={fit}>
      <video
        ref={videoElementReference}
        data-media
        src={src}
        poster={poster}
        loop={loop}
        controls={controls}
        muted
        playsInline
        preload={loadsVideo ? "auto" : "none"}
        onLoadedMetadata={(loadEvent) =>
          rememberProportions(loadEvent.currentTarget, loadEvent.currentTarget.videoWidth, loadEvent.currentTarget.videoHeight)
        }
      />
    </MediaFrame>
  );
}
