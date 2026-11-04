import { useMemo } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";

export type RemoteSlideJumpProperties = {
  languageCode: string;
  shownSlideNumber: number;
  shownSlideCount: number;
  jumpToSlide: (shownSlideNumber: number) => void;
};

// The slide number is picked from a dropdown with every slide: no typing on the phone, one tap opens the list,
// and the chosen number jumps at once.
export function RemoteSlideJump({ languageCode, shownSlideNumber, shownSlideCount, jumpToSlide }: RemoteSlideJumpProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const slideNumberOptions = useMemo(
    () => Array.from({ length: shownSlideCount }, (_, slideIndex) => slideIndex + 1),
    [shownSlideCount],
  );
  return (
    <div data-remote-jump>
      <select
        data-remote-jump-select
        value={shownSlideNumber}
        onChange={(changeEvent) => jumpToSlide(Number(changeEvent.target.value))}
        aria-label={interfaceTexts.remoteSlideJumpLabel}
      >
        {slideNumberOptions.map((slideNumberOption) => (
          <option key={slideNumberOption} value={slideNumberOption}>
            {slideNumberOption}
          </option>
        ))}
      </select>
      <span data-remote-jump-total>{interfaceTexts.remoteSlideTotal(shownSlideCount)}</span>
    </div>
  );
}
