import type { MorphPair } from "./morph-matching.ts";

type PieceMatch = {
  outgoingPiece: HTMLElement;
  incomingPiece: HTMLElement;
};

export type CodePair = MorphPair & {
  pieceMatches: PieceMatch[];
};

function listVisibleCodeBlocks(slideElement: HTMLElement): HTMLElement[] {
  const codeElements = [...slideElement.querySelectorAll<HTMLElement>("[data-content] [data-code]")];
  return codeElements.filter((codeElement) => !codeElement.closest("[data-step]:not([data-step-reached])"));
}

// Lines without pieces are blank; they take no part in matching.
function listCodeLines(codeElement: HTMLElement): HTMLElement[][] {
  return [...codeElement.querySelectorAll<HTMLElement>("[data-code-line]")]
    .map((lineElement) => [...lineElement.querySelectorAll<HTMLElement>("[data-code-token]")])
    .filter((linePieces) => linePieces.length > 0);
}

function readPieceTexts(codePieces: HTMLElement[]): string[] {
  return codePieces.map((codePiece) => codePiece.textContent);
}

// The longest common subsequence keeps the order, so matched pieces never cross each other on the way.
function matchSequences(outgoingTexts: string[], incomingTexts: string[]): Array<[number, number]> {
  const rowLength = incomingTexts.length + 1;
  const commonLengths = new Uint32Array((outgoingTexts.length + 1) * rowLength);
  for (let outgoingPosition = outgoingTexts.length - 1; outgoingPosition >= 0; outgoingPosition -= 1) {
    for (let incomingPosition = incomingTexts.length - 1; incomingPosition >= 0; incomingPosition -= 1) {
      const cellIndex = outgoingPosition * rowLength + incomingPosition;
      commonLengths[cellIndex] =
        outgoingTexts[outgoingPosition] === incomingTexts[incomingPosition]
          ? commonLengths[cellIndex + rowLength + 1]! + 1
          : Math.max(commonLengths[cellIndex + rowLength]!, commonLengths[cellIndex + 1]!);
    }
  }
  const matchedPositions: Array<[number, number]> = [];
  let outgoingPosition = 0;
  let incomingPosition = 0;
  while (outgoingPosition < outgoingTexts.length && incomingPosition < incomingTexts.length) {
    const cellIndex = outgoingPosition * rowLength + incomingPosition;
    if (outgoingTexts[outgoingPosition] === incomingTexts[incomingPosition]) {
      matchedPositions.push([outgoingPosition, incomingPosition]);
      outgoingPosition += 1;
      incomingPosition += 1;
    } else if (commonLengths[cellIndex + rowLength]! >= commonLengths[cellIndex + 1]!) {
      outgoingPosition += 1;
    } else {
      incomingPosition += 1;
    }
  }
  return matchedPositions;
}

// Like a text diff: unchanged lines are matched first, then the pieces of changed lines between them.
function matchCodeLines(outgoingLines: HTMLElement[][], incomingLines: HTMLElement[][]): PieceMatch[] {
  const lineAnchors = matchSequences(
    outgoingLines.map((linePieces) => readPieceTexts(linePieces).join(" ")),
    incomingLines.map((linePieces) => readPieceTexts(linePieces).join(" ")),
  );
  const pieceMatches: PieceMatch[] = [];
  const matchPieces = (outgoingPieces: HTMLElement[], incomingPieces: HTMLElement[]) => {
    for (const [outgoingPosition, incomingPosition] of matchSequences(readPieceTexts(outgoingPieces), readPieceTexts(incomingPieces))) {
      pieceMatches.push({ outgoingPiece: outgoingPieces[outgoingPosition]!, incomingPiece: incomingPieces[incomingPosition]! });
    }
  };
  let outgoingGapStart = 0;
  let incomingGapStart = 0;
  for (const [outgoingLineIndex, incomingLineIndex] of [...lineAnchors, [outgoingLines.length, incomingLines.length] as const]) {
    matchPieces(outgoingLines.slice(outgoingGapStart, outgoingLineIndex).flat(), incomingLines.slice(incomingGapStart, incomingLineIndex).flat());
    if (outgoingLineIndex < outgoingLines.length) matchPieces(outgoingLines[outgoingLineIndex]!, incomingLines[incomingLineIndex]!);
    outgoingGapStart = outgoingLineIndex + 1;
    incomingGapStart = incomingLineIndex + 1;
  }
  return pieceMatches;
}

// Code blocks pair up in order, like Keynote's magic move; under half shared means unrelated snippets.
export function findCodePairs(outgoingSlide: HTMLElement, incomingSlide: HTMLElement): CodePair[] {
  const incomingBlocks = listVisibleCodeBlocks(incomingSlide);
  return listVisibleCodeBlocks(outgoingSlide).flatMap((outgoingElement, blockPosition): CodePair[] => {
    const incomingElement = incomingBlocks[blockPosition];
    if (incomingElement === undefined) return [];
    const outgoingLines = listCodeLines(outgoingElement);
    const incomingLines = listCodeLines(incomingElement);
    const pieceMatches = matchCodeLines(outgoingLines, incomingLines);
    const shorterPieceCount = Math.min(outgoingLines.flat().length, incomingLines.flat().length);
    if (pieceMatches.length === 0 || pieceMatches.length * 2 < shorterPieceCount) return [];
    return [{ outgoingElement, incomingElement, pieceMatches }];
  });
}

function isInsideViewport(codePiece: HTMLElement, viewportBox: DOMRect): boolean {
  const pieceBox = codePiece.getBoundingClientRect();
  return pieceBox.bottom > viewportBox.top && pieceBox.top < viewportBox.bottom && pieceBox.right > viewportBox.left && pieceBox.left < viewportBox.right;
}

// Only visible pieces get a layer: a layer is not clipped by the code box.
export function nameCodePieceLayers(codePairs: CodePair[], side: "outgoing" | "incoming"): () => void {
  const namedPieces: HTMLElement[] = [];
  codePairs.forEach((codePair, pairPosition) => {
    const codeElement = side === "outgoing" ? codePair.outgoingElement : codePair.incomingElement;
    const viewportBox = codeElement.querySelector("[data-code-viewport]")?.getBoundingClientRect();
    if (viewportBox === undefined) return;
    codePair.pieceMatches.forEach((pieceMatch, matchPosition) => {
      const codePiece = side === "outgoing" ? pieceMatch.outgoingPiece : pieceMatch.incomingPiece;
      if (!isInsideViewport(codePiece, viewportBox)) return;
      codePiece.style.viewTransitionName = `code-piece-${pairPosition}-${matchPosition}`;
      namedPieces.push(codePiece);
    });
  });
  return () => {
    for (const namedPiece of namedPieces) namedPiece.style.removeProperty("view-transition-name");
  };
}
