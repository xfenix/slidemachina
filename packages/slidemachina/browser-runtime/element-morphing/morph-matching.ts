import { listTextWords, matchWords, type WordMatch } from "./word-morphing.ts";

const textSelector = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption";
const mediaSelector = "img, video, iframe";
const codeSelector = "pre";
const candidateSelector = `[morph], ${textSelector}, ${mediaSelector}, ${codeSelector}`;
// Engine blocks with a fixed role pair by their order on the slide when nothing pairs them exactly.
const orderedBlockRoles = [
  { roleName: "card", roleSelector: ".machina-card" },
  { roleName: "big-number", roleSelector: ".machina-big-number > p" },
  { roleName: "big-number-caption", roleSelector: ".machina-big-number > figcaption" },
  { roleName: "bar", roleSelector: ".machina-bars > li" },
];
const orderedBlockSelector = orderedBlockRoles.map((blockRole) => blockRole.roleSelector).join(", ");

export type MorphPair = {
  outgoingElement: HTMLElement;
  incomingElement: HTMLElement;
};
export type RewordedPair = MorphPair & {
  wordMatches: WordMatch[];
  // Every word stays: the text only moves or changes size, so its words travel the whole transition.
  keepsEveryWord: boolean;
};

function listVisibleCandidates(slideElement: HTMLElement, selector: string): HTMLElement[] {
  const contentElement = slideElement.querySelector<HTMLElement>("[data-content]");
  const candidateElements = [...(contentElement?.querySelectorAll<HTMLElement>(selector) ?? [])];
  // <Code> blocks morph piece by piece in code-morphing.ts.
  return candidateElements.filter(
    (candidateElement) => !candidateElement.closest("[data-step]:not([data-step-reached]), [data-code]"),
  );
}

// data-morph-text marks text inside other blocks, such as a diagram box label, so it does not stretch with its box.
// An empty text tag, such as a bar of machina-bars, is a shape: its layer draws the background and the corners.
export function isTextElement(candidateElement: HTMLElement): boolean {
  if (candidateElement.hasAttribute("data-morph-text")) return true;
  return candidateElement.matches(`${textSelector}, ${codeSelector}`) && candidateElement.textContent.trim() !== "";
}

// Same rules as reveal.js auto-animate: explicit morph name first, then text, media source and code.
function describeMorphKey(candidateElement: HTMLElement): string | undefined {
  const explicitName = candidateElement.getAttribute("morph");
  if (explicitName) return `morph:${explicitName}`;
  if (candidateElement.matches(mediaSelector)) {
    const mediaSource = candidateElement.getAttribute("src");
    return mediaSource ? `${candidateElement.tagName}:${mediaSource}` : undefined;
  }
  const normalizedText = candidateElement.textContent.replace(/\s+/g, " ").trim();
  return normalizedText ? `${candidateElement.tagName}:${normalizedText}` : undefined;
}

// A bar keeps its place in the row: the third bar of a chart pairs with the third bar of the same chart.
function describeRoleKey(candidateElement: HTMLElement): string | undefined {
  if (candidateElement.hasAttribute("morph")) return undefined;
  const blockRole = orderedBlockRoles.find((orderedRole) => candidateElement.matches(orderedRole.roleSelector));
  if (blockRole?.roleName !== "bar") return blockRole?.roleName;
  return `bar:${[...candidateElement.parentElement!.children].indexOf(candidateElement)}`;
}

// Repeated keys pair up in document order: the second "Итоги" matches the second "Итоги".
function collectKeyedElements(
  slideElement: HTMLElement,
  selector: string,
  describeKey: (candidateElement: HTMLElement) => string | undefined,
  pairedElements: Set<HTMLElement>,
): Map<string, HTMLElement> {
  const keyedElements = new Map<string, HTMLElement>();
  const occurrenceCounts = new Map<string, number>();
  for (const candidateElement of listVisibleCandidates(slideElement, selector)) {
    const morphKey = pairedElements.has(candidateElement) ? undefined : describeKey(candidateElement);
    if (morphKey === undefined) continue;
    const occurrenceNumber = (occurrenceCounts.get(morphKey) ?? 0) + 1;
    occurrenceCounts.set(morphKey, occurrenceNumber);
    keyedElements.set(`${morphKey}#${occurrenceNumber}`, candidateElement);
  }
  return keyedElements;
}

function pairKeyedElements(
  outgoingSlide: HTMLElement,
  incomingSlide: HTMLElement,
  selector: string,
  describeKey: (candidateElement: HTMLElement) => string | undefined,
  pairedElements: Set<HTMLElement>,
): MorphPair[] {
  const incomingElements = collectKeyedElements(incomingSlide, selector, describeKey, pairedElements);
  const morphPairs: MorphPair[] = [];
  for (const [morphKey, outgoingElement] of collectKeyedElements(outgoingSlide, selector, describeKey, pairedElements)) {
    const incomingElement = incomingElements.get(morphKey);
    if (incomingElement !== undefined) morphPairs.push({ outgoingElement, incomingElement });
  }
  return morphPairs;
}

// Exact pairs first, then engine blocks by order among the rest: a changed number still glides into its place.
export function findMorphPairs(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): MorphPair[] {
  const exactPairs = pairKeyedElements(outgoingSlide, incomingSlide, candidateSelector, describeMorphKey, new Set());
  const exactlyPairedElements = new Set(exactPairs.flatMap((morphPair) => [morphPair.outgoingElement, morphPair.incomingElement]));
  return [...exactPairs, ...pairKeyedElements(outgoingSlide, incomingSlide, orderedBlockSelector, describeRoleKey, exactlyPairedElements)];
}

// Innermost text only: a <li> with a <p> inside is reworded through the <p>.
function listRewordableElements(slideElement: HTMLElement, pairedElements: Set<HTMLElement>): HTMLElement[] {
  return listVisibleCandidates(slideElement, textSelector).filter(
    (textElement) => !pairedElements.has(textElement) && !textElement.hasAttribute("morph") && !textElement.querySelector(textSelector),
  );
}

function countRealWords(textWords: string[]): number {
  return textWords.filter((textWord) => /[\p{L}\p{N}]/u.test(textWord)).length;
}

// "Python 3.14" → "Python 3.15": same tag and at least half the words shared, punctuation aside.
export function findRewordedPairs(outgoingSlide: HTMLElement, incomingSlide: HTMLElement, morphPairs: MorphPair[]): RewordedPair[] {
  const pairedElements = new Set(morphPairs.flatMap((morphPair) => [morphPair.outgoingElement, morphPair.incomingElement]));
  const incomingCandidates = listRewordableElements(incomingSlide, pairedElements).map((incomingElement) => ({
    incomingElement,
    incomingWords: listTextWords(incomingElement),
  }));
  const rewordedPairs: RewordedPair[] = [];
  for (const outgoingElement of listRewordableElements(outgoingSlide, pairedElements)) {
    const outgoingWords = listTextWords(outgoingElement);
    let bestPair: RewordedPair | undefined;
    for (const { incomingElement, incomingWords } of incomingCandidates) {
      if (incomingElement.tagName !== outgoingElement.tagName || pairedElements.has(incomingElement)) continue;
      const wordMatches = matchWords(outgoingWords, incomingWords);
      const sharedWordCount = countRealWords(wordMatches.map((wordMatch) => outgoingWords[wordMatch.outgoingWordPosition]!));
      const longerWordCount = Math.max(countRealWords(outgoingWords), countRealWords(incomingWords));
      const sharesEnoughWords = sharedWordCount > 0 && sharedWordCount * 2 >= longerWordCount;
      if (sharesEnoughWords && wordMatches.length > (bestPair?.wordMatches.length ?? 0)) {
        bestPair = { outgoingElement, incomingElement, wordMatches, keepsEveryWord: false };
      }
    }
    if (bestPair === undefined) continue;
    pairedElements.add(bestPair.incomingElement);
    rewordedPairs.push(bestPair);
  }
  return rewordedPairs;
}

// Paired text morphs word by word too: two snapshots of one line at different sizes or widths never line up and show it twice.
export function rewordPairedTexts(morphPairs: MorphPair[]): { shapePairs: MorphPair[]; textPairs: RewordedPair[] } {
  const shapePairs: MorphPair[] = [];
  const textPairs: RewordedPair[] = [];
  for (const morphPair of morphPairs) {
    const { outgoingElement, incomingElement } = morphPair;
    const isInnermostText = [outgoingElement, incomingElement].every(
      (pairedElement) => pairedElement.matches(textSelector) && !pairedElement.querySelector(textSelector),
    );
    const outgoingWords = isInnermostText ? listTextWords(outgoingElement) : [];
    const incomingWords = isInnermostText ? listTextWords(incomingElement) : [];
    const wordMatches = matchWords(outgoingWords, incomingWords);
    if (wordMatches.length === 0) {
      shapePairs.push(morphPair);
      continue;
    }
    const keepsEveryWord = wordMatches.length === outgoingWords.length && wordMatches.length === incomingWords.length;
    textPairs.push({ ...morphPair, wordMatches, keepsEveryWord });
  }
  return { shapePairs, textPairs };
}
