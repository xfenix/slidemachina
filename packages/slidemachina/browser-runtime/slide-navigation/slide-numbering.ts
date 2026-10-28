export type MoveDirection = 1 | -1;
// Hidden slides stay out of the count: the first hidden slide after slide 12 is "12+1", the next one "12+2".
export type SlideNumbering = {
  hiddenFlags: boolean[];
  // "12" or "12+1": the address in the hash, the navigator, the minimap and the presenter window.
  slideAddresses: string[];
  // A hidden slide takes the number of the shown slide before it, 0 before the first one.
  shownNumbers: number[];
  shownSlideIndexes: number[];
};

export function numberSlides(hiddenFlags: boolean[]): SlideNumbering {
  const slideAddresses: string[] = [];
  const shownNumbers: number[] = [];
  const shownSlideIndexes: number[] = [];
  let hiddenSinceShown = 0;
  hiddenFlags.forEach((isHidden, slideIndex) => {
    if (isHidden) hiddenSinceShown += 1;
    else {
      shownSlideIndexes.push(slideIndex);
      hiddenSinceShown = 0;
    }
    const shownNumber = shownSlideIndexes.length;
    shownNumbers.push(shownNumber);
    slideAddresses.push(isHidden ? `${shownNumber}+${hiddenSinceShown}` : String(shownNumber));
  });
  return { hiddenFlags, slideAddresses, shownNumbers, shownSlideIndexes };
}

// A move from a shown slide skips hidden ones; a move from a hidden slide goes to its neighbour, so backup slides can be walked in a row.
export function findNeighbourSlide({ hiddenFlags }: SlideNumbering, slideIndex: number, moveDirection: MoveDirection): number | undefined {
  for (let neighbourIndex = slideIndex + moveDirection; neighbourIndex >= 0 && neighbourIndex < hiddenFlags.length; neighbourIndex += moveDirection) {
    if (hiddenFlags[slideIndex] === true || hiddenFlags[neighbourIndex] !== true) return neighbourIndex;
  }
  return undefined;
}

// Typed numbers, Home and End reach shown slides only; a number past the end means the last one.
export function findShownSlide({ shownSlideIndexes }: SlideNumbering, shownNumber: number): number {
  return shownSlideIndexes[Math.min(Math.max(shownNumber, 1), shownSlideIndexes.length) - 1] ?? 0;
}
