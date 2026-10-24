// Elements swapping places bend to opposite sides instead of blurring into one; labels stay with their box.
const arcDepth = 0.25;

export type MovingLayer = {
  layerName: string;
  outgoingElement: HTMLElement;
  incomingElement: HTMLElement;
  startBox: DOMRect;
  endBox?: DOMRect;
};

function findMidwayBox(startBox: DOMRect, endBox: DOMRect): DOMRect {
  return new DOMRect(
    (startBox.x + endBox.x) / 2,
    (startBox.y + endBox.y) / 2,
    (startBox.width + endBox.width) / 2,
    (startBox.height + endBox.height) / 2,
  );
}

function doBoxesOverlap(firstBox: DOMRect, secondBox: DOMRect): boolean {
  return firstBox.left < secondBox.right && secondBox.left < firstBox.right && firstBox.top < secondBox.bottom && secondBox.top < firstBox.bottom;
}

function findCenterShift(startBox: DOMRect, endBox: DOMRect) {
  return {
    horizontalShift: endBox.x + endBox.width / 2 - (startBox.x + startBox.width / 2),
    verticalShift: endBox.y + endBox.height / 2 - (startBox.y + startBox.height / 2),
  };
}

// Runs once the transition is ready: the extra translate rides on top of the browser's own move, with the same timing.
export function bendCrossingPaths(movingLayers: MovingLayer[]) {
  const measuredLayers = movingLayers.flatMap(({ layerName, outgoingElement, startBox, endBox }) =>
    endBox === undefined ? [] : [{ layerName, outgoingElement, startBox, endBox, midwayBox: findMidwayBox(startBox, endBox) }],
  );
  for (const measuredLayer of measuredLayers) {
    const isNested = measuredLayers.some(
      (otherLayer) =>
        otherLayer !== measuredLayer &&
        (otherLayer.outgoingElement.contains(measuredLayer.outgoingElement) || measuredLayer.outgoingElement.contains(otherLayer.outgoingElement)),
    );
    const swapsWithAnotherLayer = measuredLayers.some(
      (otherLayer) =>
        otherLayer !== measuredLayer &&
        doBoxesOverlap(otherLayer.midwayBox, measuredLayer.midwayBox) &&
        doBoxesOverlap(otherLayer.startBox, measuredLayer.endBox),
    );
    if (isNested || !swapsWithAnotherLayer) continue;
    const groupSelector = `::view-transition-group(${measuredLayer.layerName})`;
    const browserMove = document.getAnimations().find((runningAnimation) => (runningAnimation.effect as KeyframeEffect | null)?.pseudoElement === groupSelector);
    if (!browserMove?.effect) continue;
    const { horizontalShift, verticalShift } = findCenterShift(measuredLayer.startBox, measuredLayer.endBox);
    const arcPeakShift = { horizontal: -verticalShift * arcDepth, vertical: horizontalShift * arcDepth };
    const formatArcPoint = (arcShare: number) => `${arcPeakShift.horizontal * arcShare}px ${arcPeakShift.vertical * arcShare}px`;
    document.documentElement.animate(
      { translate: [formatArcPoint(0), formatArcPoint(Math.SQRT1_2), formatArcPoint(1), formatArcPoint(Math.SQRT1_2), formatArcPoint(0)] },
      { ...browserMove.effect.getTiming(), fill: "none", pseudoElement: groupSelector },
    );
  }
}
