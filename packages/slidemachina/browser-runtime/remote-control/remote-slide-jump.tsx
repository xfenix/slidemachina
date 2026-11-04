import { useState } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";

export type RemoteSlideJumpProperties = {
  languageCode: string;
  shownSlideNumber: number;
  shownSlideCount: number;
  jumpToSlide: (shownSlideNumber: number) => void;
};

// The slide number is typed over like the code field: digits only, the phone keyboard is enough. Enter or a tap
// outside jumps; an empty or wrong value falls back to the current slide when the field loses focus.
export function RemoteSlideJump({ languageCode, shownSlideNumber, shownSlideCount, jumpToSlide }: RemoteSlideJumpProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [typedDigits, setTypedDigits] = useState("");
  const commitTypedDigits = () => {
    const typedNumber = Number(typedDigits);
    if (typedDigits !== "" && Number.isInteger(typedNumber) && typedNumber >= 1) jumpToSlide(typedNumber);
    setTypedDigits("");
  };
  return (
    <div data-remote-jump>
      <input
        data-remote-jump-input
        value={typedDigits === "" ? String(shownSlideNumber) : typedDigits}
        onChange={(inputEvent) => setTypedDigits(inputEvent.target.value.replace(/\D/g, "").slice(0, String(shownSlideCount).length))}
        onBlur={commitTypedDigits}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === "Enter") {
            keyboardEvent.preventDefault();
            commitTypedDigits();
          }
        }}
        onFocus={(focusEvent) => focusEvent.target.select()}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        aria-label={interfaceTexts.remoteSlideJumpLabel}
      />
      <span data-remote-jump-total>{interfaceTexts.remoteSlideTotal(shownSlideCount)}</span>
    </div>
  );
}
