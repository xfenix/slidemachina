import { useEffect, useState } from "react";

const typingPauseLimit = 3000;

// Digits typed on a slide and confirmed with Enter jump to the slide with that number.
export function useTypedSlideNumber(jumpToSlideNumber: (slideNumber: number) => void) {
  const [typedDigits, setTypedDigits] = useState("");

  useEffect(() => {
    if (typedDigits === "") return;
    const forgetTimer = window.setTimeout(() => setTypedDigits(""), typingPauseLimit);
    return () => window.clearTimeout(forgetTimer);
  }, [typedDigits]);

  return {
    digits: typedDigits,
    appendDigit: (typedDigit: string) => setTypedDigits((previousDigits) => previousDigits + typedDigit),
    confirmNumber: () => {
      if (typedDigits !== "") jumpToSlideNumber(Number(typedDigits));
      setTypedDigits("");
    },
  };
}
