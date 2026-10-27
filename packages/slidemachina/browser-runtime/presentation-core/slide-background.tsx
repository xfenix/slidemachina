import { useEffect, useRef } from "react";
import { classifySlideBackground, readBackgroundAddress, type SlideBackgroundValue } from "./background-tone.ts";
import { useSlideEnvironment } from "./slide-environment.ts";

// Video and page backgrounds are elements under the content; they load near their slide, as <Video> does.
export function SlideBackgroundLayer({ backgroundValue }: { backgroundValue: SlideBackgroundValue }) {
  const { isCurrentSlide, isSlideNearby, isSlideCopy } = useSlideEnvironment();
  const videoElementReference = useRef<HTMLVideoElement>(null);
  const backgroundKind = classifySlideBackground(backgroundValue);

  useEffect(() => {
    const videoElement = videoElementReference.current;
    if (videoElement === null) return;
    if (isCurrentSlide) void videoElement.play().catch(() => {});
    else videoElement.pause();
  }, [isCurrentSlide]);

  if (backgroundKind === "video") {
    return (
      <video
        ref={videoElementReference}
        data-slide-background="video"
        src={readBackgroundAddress(backgroundValue)}
        loop
        muted
        playsInline
        preload={isSlideNearby || isSlideCopy ? "auto" : "none"}
        aria-hidden="true"
      />
    );
  }
  // A page is live only on the screen: thumbnails and printed pages keep the slide colour.
  if (backgroundKind === "iframe" && isSlideNearby) {
    return <iframe data-slide-background="iframe" src={readBackgroundAddress(backgroundValue)} title={readBackgroundAddress(backgroundValue)} tabIndex={-1} aria-hidden="true" />;
  }
  return null;
}
