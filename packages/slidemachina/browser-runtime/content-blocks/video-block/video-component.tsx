import { useEffect, useRef, type ReactNode } from "react";
import { useSlideEnvironment } from "../../presentation-core/slide-environment.ts";
import { MediaFrame, rememberProportions, type MediaPlacement } from "../media-frame.tsx";

export type VideoProperties = MediaPlacement & {
  src: string;
  poster?: string;
  loop?: boolean;
  controls?: boolean;
  // A <figcaption> here stays with the video, as with <Image>.
  children?: ReactNode;
};

// Plays muted only while its slide is on screen and loads only near its slide.
export function Video({ src, poster, loop = true, controls = false, stretch, full, fit, children }: VideoProperties) {
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
    <MediaFrame stretch={stretch} full={full} fit={fit} caption={children}>
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
