import { nameCodePieceLayers, type CodePair } from "../element-morphing/code-morphing.ts";
import { isTextElement, type MorphPair, type RewordedPair } from "../element-morphing/morph-matching.ts";
import { nameWordLayers } from "../element-morphing/word-morphing.ts";

export type NamedLayer = {
  outgoingElement: HTMLElement | null;
  incomingElement: HTMLElement | null;
  layerName: string;
  layerClass?: string;
};

const framePartSelectors = [":scope > [data-logo]", ":scope > [data-breadcrumbs]", ":scope > [data-slide-number]"];
const slideNumberSelector = ":scope > [data-slide-number]";

export function clearLayerName(namedElement: HTMLElement | null) {
  namedElement?.style.removeProperty("view-transition-name");
  namedElement?.style.removeProperty("view-transition-class");
  namedElement?.removeAttribute("data-morph-clipped");
}

export function clearLayerNames(namedLayers: NamedLayer[]) {
  for (const namedLayer of namedLayers) {
    clearLayerName(namedLayer.outgoingElement);
    clearLayerName(namedLayer.incomingElement);
  }
}

// A clipped picture leaves its corners and edge to its layer group, which rounds and outlines both snapshots at once.
export function nameLayer(namedElement: HTMLElement | null, namedLayer: NamedLayer) {
  namedElement?.style.setProperty("view-transition-name", namedLayer.layerName);
  if (namedLayer.layerClass) namedElement?.style.setProperty("view-transition-class", namedLayer.layerClass);
  if (namedLayer.layerClass === "clipped-media") namedElement?.setAttribute("data-morph-clipped", "");
}

export function restoreLayers(layerRestorers: Array<() => void>) {
  for (const restoreLayer of layerRestorers) restoreLayer();
}

export function describeWordLayerPrefix(pairPosition: number): string {
  return `morph-word-${pairPosition}`;
}

// Reworded text and code get a layer per piece; shared pieces have the same name on both slides.
export function nameMovingParts(rewordedPairs: RewordedPair[], codePairs: CodePair[], side: "outgoing" | "incoming") {
  const wordRestorers = rewordedPairs.map((rewordedPair, pairPosition) =>
    nameWordLayers(
      side === "outgoing" ? rewordedPair.outgoingElement : rewordedPair.incomingElement,
      rewordedPair.wordMatches.map((wordMatch) =>
        side === "outgoing" ? wordMatch.outgoingWordPosition : wordMatch.incomingWordPosition,
      ),
      describeWordLayerPrefix(pairPosition),
      rewordedPair.keepsEveryWord ? "carried-word" : "moving-word",
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

// Parts marked data-morph-apart or named with morph get their own layers, or they would stretch with their group's snapshot:
// a new diagram box appears in its place instead of growing out of its group. A part with a pair of its own morphs.
function describeApartLayers(morphPairs: MorphPair[]): NamedLayer[] {
  const pairedElements = new Set(morphPairs.flatMap((morphPair) => [morphPair.outgoingElement, morphPair.incomingElement]));
  const listApartParts = (pairedElement: HTMLElement) =>
    [...pairedElement.querySelectorAll<HTMLElement>("[data-morph-apart], [morph]")].filter((apartPart) => !pairedElements.has(apartPart));
  return morphPairs.flatMap(({ outgoingElement, incomingElement }, pairPosition) => [
    ...listApartParts(outgoingElement).map((apartPart, partPosition) => ({
      outgoingElement: apartPart,
      incomingElement: null,
      layerName: `apart-out-${pairPosition}-${partPosition}`,
      layerClass: apartPart.hasAttribute("data-morph-apart") ? "leaving-part" : "leaving-block",
    })),
    ...listApartParts(incomingElement).map((apartPart, partPosition) => ({
      outgoingElement: null,
      incomingElement: apartPart,
      layerName: `apart-in-${pairPosition}-${partPosition}`,
      layerClass: apartPart.hasAttribute("data-morph-apart") ? "arriving-part" : "arriving-block",
    })),
  ]);
}

// Slide, cube, flip and zoom move whole slides with their background, logo and number.
// Zoom moves the content apart from its slide: the old text is gone before the new one shows, so two texts never overlap.
export function describeWholeSlideLayers(outgoingSlide: HTMLElement, incomingSlide: HTMLElement, chosenTransition: string): NamedLayer[] {
  const slideLayers: NamedLayer[] = [
    { outgoingElement: outgoingSlide, incomingElement: null, layerName: "slide-out" },
    { outgoingElement: null, incomingElement: incomingSlide, layerName: "slide-in" },
  ];
  if (chosenTransition !== "zoom") return slideLayers;
  return [
    ...slideLayers,
    { outgoingElement: outgoingSlide.querySelector("[data-content]"), incomingElement: null, layerName: "zoom-content-out" },
    { outgoingElement: null, incomingElement: incomingSlide.querySelector("[data-content]"), layerName: "zoom-content-in" },
  ];
}

// A logo or breadcrumbs only one slide has, and a changed number, leave and arrive like the content: the target slide
// shows no stray breadcrumbs, and the digits of two numbers never overlap. The rest stays in the page root and blends.
function describeFrameLayers(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): NamedLayer[] {
  return framePartSelectors.flatMap((framePartSelector, partPosition) => {
    const outgoingPart = outgoingSlide.querySelector<HTMLElement>(framePartSelector);
    const incomingPart = incomingSlide.querySelector<HTMLElement>(framePartSelector);
    const isChangedNumber = framePartSelector === slideNumberSelector && outgoingPart?.textContent !== incomingPart?.textContent;
    if ((outgoingPart !== null) === (incomingPart !== null) && !isChangedNumber) return [];
    return [
      { outgoingElement: outgoingPart, incomingElement: null, layerName: `frame-out-${partPosition}`, layerClass: "leaving-frame" },
      { outgoingElement: null, incomingElement: incomingPart, layerName: `frame-in-${partPosition}`, layerClass: "arriving-frame" },
    ];
  });
}

function hasPlainColor(slideElement: HTMLElement): boolean {
  return slideElement.querySelector(":scope > [data-slide-background]") === null && getComputedStyle(slideElement).backgroundImage === "none";
}

// Between two plain slides of different colours the new colour floods the slide in a growing circle instead of blending
// with the old one into a dull middle. Only when nothing morphs: a moving picture or text already carries the transition.
// The slide itself becomes a layer that holds only its colour, so the frame parts both slides keep move to layers of their own.
function describeColorLayers(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): NamedLayer[] {
  const isColorFlood =
    hasPlainColor(outgoingSlide) &&
    hasPlainColor(incomingSlide) &&
    getComputedStyle(outgoingSlide).backgroundColor !== getComputedStyle(incomingSlide).backgroundColor;
  if (!isColorFlood) return [];
  const keptFrameLayers = framePartSelectors.flatMap((framePartSelector, partPosition) => {
    const outgoingPart = outgoingSlide.querySelector<HTMLElement>(framePartSelector);
    const incomingPart = incomingSlide.querySelector<HTMLElement>(framePartSelector);
    const isChangedNumber = framePartSelector === slideNumberSelector && outgoingPart?.textContent !== incomingPart?.textContent;
    if (outgoingPart === null || incomingPart === null || isChangedNumber) return [];
    return [{ outgoingElement: outgoingPart, incomingElement: incomingPart, layerName: `frame-kept-${partPosition}` }];
  });
  return [{ outgoingElement: outgoingSlide, incomingElement: incomingSlide, layerName: "slide-color", layerClass: "slide-color" }, ...keptFrameLayers];
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
  namedLayers.push(...describeFrameLayers(outgoingSlide, incomingSlide));
  if (morphPairs.length + rewordedPairs.length + codePairs.length === 0) namedLayers.push(...describeColorLayers(outgoingSlide, incomingSlide));
  namedLayers.push(...describeApartLayers(morphPairs));
  // The reworded element keeps what is not a word, such as a list bullet, steady while its words move.
  rewordedPairs.forEach(({ outgoingElement, incomingElement }, pairPosition) =>
    namedLayers.push({ outgoingElement, incomingElement, layerName: `reworded-${pairPosition}`, layerClass: "reworded-text" }),
  );
  return [...namedLayers, ...describeCodeLayers(codePairs)];
}
