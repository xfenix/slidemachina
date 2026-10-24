import { listTextWords, matchWords, type WordMatch } from "./word-morphing.ts";

const textSelector = "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption";
const mediaSelector = "img, video, iframe";
const codeSelector = "pre";
const candidateSelector = `[morph], ${textSelector}, ${mediaSelector}, ${codeSelector}`;

export type MorphPair = {
  outgoingElement: HTMLElement;
  incomingElement: HTMLElement;
};

export type RewordedPair = MorphPair & {
  wordMatches: WordMatch[];
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
export function isTextElement(candidateElement: HTMLElement): boolean {
  return candidateElement.matches(`${textSelector}, ${codeSelector}, [data-morph-text]`);
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

// Repeated keys pair up in document order: the second "Итоги" matches the second "Итоги".
function collectKeyedElements(slideElement: HTMLElement): Map<string, HTMLElement> {
  const keyedElements = new Map<string, HTMLElement>();
  const occurrenceCounts = new Map<string, number>();
  for (const candidateElement of listVisibleCandidates(slideElement, candidateSelector)) {
    const morphKey = describeMorphKey(candidateElement);
    if (morphKey === undefined) continue;
    const occurrenceNumber = (occurrenceCounts.get(morphKey) ?? 0) + 1;
    occurrenceCounts.set(morphKey, occurrenceNumber);
    keyedElements.set(`${morphKey}#${occurrenceNumber}`, candidateElement);
  }
  return keyedElements;
}

export function findMorphPairs(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): MorphPair[] {
  const incomingElements = collectKeyedElements(incomingSlide);
  const morphPairs: MorphPair[] = [];
  for (const [morphKey, outgoingElement] of collectKeyedElements(outgoingSlide)) {
    const incomingElement = incomingElements.get(morphKey);
    if (incomingElement !== undefined) morphPairs.push({ outgoingElement, incomingElement });
  }
  return morphPairs;
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
        bestPair = { outgoingElement, incomingElement, wordMatches };
      }
    }
    if (bestPair === undefined) continue;
    pairedElements.add(bestPair.incomingElement);
    rewordedPairs.push(bestPair);
  }
  return rewordedPairs;
}
