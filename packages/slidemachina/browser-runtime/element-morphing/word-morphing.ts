// Punctuation is a word of its own, so "пункта" still pairs with "пункта:"; dots inside "3.14" stay.
const wordPattern = /[^\s.,:;!?…«»()"]+(?:[.,:][^\s.,:;!?…«»()"]+)*|[.,:;!?…«»()"]+/gu;
// Steps a transition can treat as reached without touching the DOM: the arrival step is applied only when the transition runs.
export type StepReachedPredicate = (stepElement: HTMLElement) => boolean;
const unreachedStepSelector = "[data-step]:not([data-step-reached])";

// The nearest step ancestor (or the element itself) that the predicate keeps unreached; the live-DOM path matches it with one native closest call.
export function findUnreachedStepAncestor(walkedElement: HTMLElement, isStepReached: StepReachedPredicate): HTMLElement | null {
  let ancestorElement: HTMLElement | null = walkedElement;
  while (ancestorElement !== null) {
    if (ancestorElement.hasAttribute("data-step") && !isStepReached(ancestorElement)) return ancestorElement;
    ancestorElement = ancestorElement.parentElement;
  }
  return null;
}

export type WordMatch = {
  outgoingWordPosition: number;
  incomingWordPosition: number;
};

function listVisibleTextNodes(textElement: HTMLElement, isStepReached?: StepReachedPredicate): Text[] {
  const textWalker = document.createTreeWalker(textElement, NodeFilter.SHOW_TEXT);
  const visibleTextNodes: Text[] = [];
  while (textWalker.nextNode()) {
    const textNode = textWalker.currentNode as Text;
    if (textNode.data.trim() === "") continue;
    const closestUnreachedStep =
      isStepReached === undefined
        ? textNode.parentElement?.closest(unreachedStepSelector)
        : textNode.parentElement === null
          ? null
          : findUnreachedStepAncestor(textNode.parentElement, isStepReached);
    if (closestUnreachedStep != null) continue;
    visibleTextNodes.push(textNode);
  }
  return visibleTextNodes;
}

export function listTextWords(textElement: HTMLElement, isStepReached?: StepReachedPredicate): string[] {
  return listVisibleTextNodes(textElement, isStepReached).flatMap((textNode) => textNode.data.match(wordPattern) ?? []);
}

// Repeated words pair up in order, like repeated elements in morph-matching.ts.
export function matchWords(outgoingWords: string[], incomingWords: string[]): WordMatch[] {
  const incomingPositionsByWord = new Map<string, number[]>();
  incomingWords.forEach((incomingWord, incomingWordPosition) => {
    incomingPositionsByWord.set(incomingWord, [...(incomingPositionsByWord.get(incomingWord) ?? []), incomingWordPosition]);
  });
  const wordMatches: WordMatch[] = [];
  outgoingWords.forEach((outgoingWord, outgoingWordPosition) => {
    const incomingWordPosition = incomingPositionsByWord.get(outgoingWord)?.shift();
    if (incomingWordPosition !== undefined) wordMatches.push({ outgoingWordPosition, incomingWordPosition });
  });
  return wordMatches;
}

// React keeps references to its text nodes, so the original nodes go back in place untouched.
function wrapTextNodeWords(textNode: Text, wordElements: HTMLSpanElement[]): () => void {
  const wrappedFragment = document.createDocumentFragment();
  let copiedLength = 0;
  for (const wordMatch of textNode.data.matchAll(wordPattern)) {
    wrappedFragment.append(textNode.data.slice(copiedLength, wordMatch.index));
    const wordElement = document.createElement("span");
    wordElement.textContent = wordMatch[0];
    wrappedFragment.append(wordElement);
    wordElements.push(wordElement);
    copiedLength = wordMatch.index + wordMatch[0].length;
  }
  wrappedFragment.append(textNode.data.slice(copiedLength));
  const insertedNodes = [...wrappedFragment.childNodes];
  const [firstInsertedNode] = insertedNodes;
  textNode.replaceWith(wrappedFragment);
  return () => {
    // React may have replaced the whole text meanwhile; then there is nothing to put back.
    if (firstInsertedNode?.isConnected !== true) return;
    firstInsertedNode.before(textNode);
    for (const insertedNode of insertedNodes) insertedNode.remove();
  };
}

// Every word gets its own layer until the returned function restores the text.
export function nameWordLayers(
  textElement: HTMLElement,
  matchedWordPositions: number[],
  layerNamePrefix: string,
  matchedWordClass: string,
  unmatchedWordClass: string,
): () => void {
  const wordElements: HTMLSpanElement[] = [];
  const restoreTextNodes = listVisibleTextNodes(textElement).map((textNode) => wrapTextNodeWords(textNode, wordElements));
  wordElements.forEach((wordElement, wordPosition) => {
    const matchNumber = matchedWordPositions.indexOf(wordPosition);
    if (matchNumber >= 0) {
      wordElement.style.viewTransitionName = `${layerNamePrefix}-${matchNumber}`;
      wordElement.style.setProperty("view-transition-class", matchedWordClass);
      return;
    }
    wordElement.style.viewTransitionName = `${layerNamePrefix}-${unmatchedWordClass}-${wordPosition}`;
    wordElement.style.setProperty("view-transition-class", unmatchedWordClass);
  });
  return () => {
    for (const restoreTextNode of restoreTextNodes) restoreTextNode();
  };
}
