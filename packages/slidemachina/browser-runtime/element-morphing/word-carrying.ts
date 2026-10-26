import { readBrowserMoveTiming } from "./morph-arcs.ts";
import type { RewordedPair } from "./morph-matching.ts";

export type WordBoxes = Map<string, DOMRect>;

// Boxes of the word layers inside the texts, by layer name.
export function measureWordLayers(textElements: HTMLElement[]): WordBoxes {
  return new Map(
    textElements.flatMap((textElement) =>
      [...textElement.querySelectorAll<HTMLElement>("span")]
        .filter((wordElement) => wordElement.style.viewTransitionName !== "")
        .map((wordElement) => [wordElement.style.viewTransitionName, wordElement.getBoundingClientRect()] as const),
    ),
  );
}

// A leaving word rides with its line: it follows the nearest word that stays, so the line moves as one instead of tearing.
// Runs once the transition is ready; the caller cancels the moves when it ends.
export function carryLeavingWords(
  rewordedPairs: RewordedPair[],
  describeLayerPrefix: (pairPosition: number) => string,
  outgoingBoxes: WordBoxes,
  incomingBoxes: WordBoxes,
): Animation[] {
  return rewordedPairs.flatMap(({ wordMatches }, pairPosition) => {
    const leavingPrefix = `${describeLayerPrefix(pairPosition)}-leaving-word-`;
    return [...outgoingBoxes.keys()].flatMap((layerName) => {
      if (!layerName.startsWith(leavingPrefix) || wordMatches.length === 0) return [];
      const wordPosition = Number(layerName.slice(leavingPrefix.length));
      const nearestMatchNumber = wordMatches.reduce(
        (nearestNumber, wordMatch, matchNumber) =>
          Math.abs(wordMatch.outgoingWordPosition - wordPosition) < Math.abs(wordMatches[nearestNumber]!.outgoingWordPosition - wordPosition)
            ? matchNumber
            : nearestNumber,
        0,
      );
      const stayingLayerName = `${describeLayerPrefix(pairPosition)}-${nearestMatchNumber}`;
      const startBox = outgoingBoxes.get(stayingLayerName);
      const endBox = incomingBoxes.get(stayingLayerName);
      const browserTiming = readBrowserMoveTiming(`::view-transition-group(${stayingLayerName})`);
      if (startBox === undefined || endBox === undefined || browserTiming === undefined) return [];
      return [
        document.documentElement.animate(
          { translate: ["0px 0px", `${endBox.x - startBox.x}px ${endBox.y - startBox.y}px`] },
          { ...browserTiming, id: "slidemachina-word-carry", fill: "both", pseudoElement: `::view-transition-group(${layerName})` },
        ),
      ];
    });
  });
}
