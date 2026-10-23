import { nameCodePieceLayers, type CodePair } from "./code-morphing.ts";
import { isTextElement, type MorphPair, type RewordedPair } from "./morph-matching.ts";
import { nameWordLayers } from "./word-morphing.ts";

export type NamedLayer = {
  outgoingElement: HTMLElement | null;
  incomingElement: HTMLElement | null;
  layerName: string;
  layerClass?: string;
};

export function clearLayerName(namedElement: HTMLElement | null) {
  namedElement?.style.removeProperty("view-transition-name");
  namedElement?.style.removeProperty("view-transition-class");
}

export function clearLayerNames(namedLayers: NamedLayer[]) {
  for (const namedLayer of namedLayers) {
    clearLayerName(namedLayer.outgoingElement);
    clearLayerName(namedLayer.incomingElement);
  }
}

export function nameLayer(namedElement: HTMLElement | null, namedLayer: NamedLayer) {
  namedElement?.style.setProperty("view-transition-name", namedLayer.layerName);
  if (namedLayer.layerClass) namedElement?.style.setProperty("view-transition-class", namedLayer.layerClass);
}

export function restoreLayers(layerRestorers: Array<() => void>) {
  for (const restoreLayer of layerRestorers) restoreLayer();
}

// Reworded text and code get a layer per piece; shared pieces have the same name on both slides.
export function nameMovingParts(rewordedPairs: RewordedPair[], codePairs: CodePair[], side: "outgoing" | "incoming") {
  const wordRestorers = rewordedPairs.map((rewordedPair, pairPosition) =>
    nameWordLayers(
      side === "outgoing" ? rewordedPair.outgoingElement : rewordedPair.incomingElement,
      rewordedPair.wordMatches.map((wordMatch) =>
        side === "outgoing" ? wordMatch.outgoingWordPosition : wordMatch.incomingWordPosition,
      ),
      `morph-word-${pairPosition}`,
      side === "outgoing" ? "leaving-word" : "arriving-word",
    ),
  );
  return [...wordRestorers, nameCodePieceLayers(codePairs, side)];
}

// The code box resizes, its text fades like leaving and arriving words, the title moves without stretching.
function describeCodeLayers(codePairs: CodePair[]): NamedLayer[] {
  return codePairs.flatMap(({ outgoingElement, incomingElement }, pairPosition) => {
    const codeLayers: NamedLayer[] = [
      { outgoingElement, incomingElement, layerName: `code-box-${pairPosition}` },
      {
        outgoingElement: outgoingElement.querySelector("[data-code-viewport]"),
        incomingElement: incomingElement.querySelector("[data-code-viewport]"),
        layerName: `code-text-${pairPosition}`,
        layerClass: "code-text",
      },
    ];
    const outgoingTitle = outgoingElement.querySelector<HTMLElement>("[data-code-title]");
    const incomingTitle = incomingElement.querySelector<HTMLElement>("[data-code-title]");
    if (outgoingTitle !== null && incomingTitle !== null) {
      codeLayers.push({ outgoingElement: outgoingTitle, incomingElement: incomingTitle, layerName: `code-title-${pairPosition}`, layerClass: "morph-text" });
    }
    return codeLayers;
  });
}

// A label inside a box sits in its middle, other text hangs from its top left corner.
function describeMorphClass(morphedElement: HTMLElement): string | undefined {
  if (morphedElement.hasAttribute("data-morph-text")) return "morph-label";
  return isTextElement(morphedElement) ? "morph-text" : "morph-shape";
}

// Parts marked data-morph-apart get their own layers, or they would stretch with their group's snapshot.
function describeApartLayers(morphPairs: MorphPair[]): NamedLayer[] {
  const listApartParts = (pairedElement: HTMLElement) => [...pairedElement.querySelectorAll<HTMLElement>("[data-morph-apart]")];
  return morphPairs.flatMap(({ outgoingElement, incomingElement }, pairPosition) => [
    ...listApartParts(outgoingElement).map((apartPart, partPosition) => ({
      outgoingElement: apartPart,
      incomingElement: null,
      layerName: `apart-out-${pairPosition}-${partPosition}`,
      layerClass: "leaving-part",
    })),
    ...listApartParts(incomingElement).map((apartPart, partPosition) => ({
      outgoingElement: null,
      incomingElement: apartPart,
      layerName: `apart-in-${pairPosition}-${partPosition}`,
      layerClass: "arriving-part",
    })),
  ]);
}

// Slide, cube, flip and zoom move whole slides with their background, logo and number.
export function describeWholeSlideLayers(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): NamedLayer[] {
  return [
    { outgoingElement: outgoingSlide, incomingElement: null, layerName: "slide-out" },
    { outgoingElement: null, incomingElement: incomingSlide, layerName: "slide-in" },
  ];
}

// Outgoing and incoming content move as separate layers; the frame stays in the page root with the background.
export function describeContentLayers(
  outgoingSlide: HTMLElement,
  incomingSlide: HTMLElement,
  morphPairs: MorphPair[],
  rewordedPairs: RewordedPair[],
  codePairs: CodePair[],
) {
  const namedLayers: NamedLayer[] = [
    {
      outgoingElement: outgoingSlide.querySelector("[data-content]"),
      incomingElement: null,
      layerName: "slide-content-out",
    },
    {
      outgoingElement: null,
      incomingElement: incomingSlide.querySelector("[data-content]"),
      layerName: "slide-content-in",
    },
  ];
  morphPairs.forEach((morphPair, pairPosition) => {
    namedLayers.push({ ...morphPair, layerName: `morph-${pairPosition}`, layerClass: describeMorphClass(morphPair.outgoingElement) });
  });
  namedLayers.push(...describeApartLayers(morphPairs));
  // The reworded element keeps what is not a word, such as a list bullet, steady while its words move.
  rewordedPairs.forEach(({ outgoingElement, incomingElement }, pairPosition) =>
    namedLayers.push({ outgoingElement, incomingElement, layerName: `reworded-${pairPosition}`, layerClass: "reworded-text" }),
  );
  return [...namedLayers, ...describeCodeLayers(codePairs)];
}
