type TileLayout = { columnCount: number; rowCount: number; staggerShare: number; shrinksWidth: boolean };
type TileBox = { leftEdge: number; topEdge: number; tileWidth: number; tileHeight: number; startShare: number };

const tileLayouts: Record<string, TileLayout> = {
  mosaic: { columnCount: 8, rowCount: 5, staggerShare: 0.55, shrinksWidth: true },
  blinds: { columnCount: 1, rowCount: 8, staggerShare: 0.3, shrinksWidth: false },
};
const keyframeCount = 32;
// Neighbouring tiles overlap by this much at full size, or the canvas scale shows hairline seams between them.
const tileOverlapPixels = 2;
const fullMaskLayer = "linear-gradient(#000 0 0)";
const halfTurnShare = 0.5;
const millisecondsPerSecond = 1000;

function easeSmoothly(linearProgress: number): number {
  return (1 - Math.cos(Math.PI * linearProgress)) / 2;
}

function clampProgress(rawProgress: number): number {
  return Math.min(1, Math.max(0, rawProgress));
}

// The wave runs from the top left corner; going back it runs from the opposite corner, as the same transition in reverse.
function measureTileBoxes(tileLayout: TileLayout, slideWidth: number, slideHeight: number, isMovingForward: boolean): TileBox[] {
  const { columnCount, rowCount, staggerShare } = tileLayout;
  const lastWaveStep = Math.max(1, columnCount + rowCount - 2);
  return Array.from({ length: columnCount * rowCount }, (_, tilePosition) => {
    const columnIndex = tilePosition % columnCount;
    const rowIndex = Math.floor(tilePosition / columnCount);
    const waveStep = columnIndex + rowIndex;
    return {
      leftEdge: (columnIndex * slideWidth) / columnCount,
      topEdge: (rowIndex * slideHeight) / rowCount,
      tileWidth: slideWidth / columnCount,
      tileHeight: slideHeight / rowCount,
      startShare: (staggerShare * (isMovingForward ? waveStep : lastWaveStep - waveStep)) / lastWaveStep,
    };
  });
}

// A tile of the old slide shrinks to its middle in the first half of its turn, the same tile of the new one grows in the second.
function describeTileFrame(tileBoxes: TileBox[], tileLayout: TileLayout, transitionShare: number, isOutgoing: boolean): Keyframe {
  const turnShare = 1 - tileLayout.staggerShare;
  const tileMasks = tileBoxes.map((tileBox) => {
    const turnProgress = clampProgress((transitionShare - tileBox.startShare) / turnShare);
    const visibleShare = isOutgoing
      ? 1 - easeSmoothly(clampProgress(turnProgress / halfTurnShare))
      : easeSmoothly(clampProgress((turnProgress - halfTurnShare) / halfTurnShare));
    const maskWidth = (tileBox.tileWidth + tileOverlapPixels) * (tileLayout.shrinksWidth ? visibleShare : 1);
    const maskHeight = (tileBox.tileHeight + tileOverlapPixels) * visibleShare;
    const maskLeft = tileBox.leftEdge + (tileBox.tileWidth - maskWidth) / 2;
    const maskTop = tileBox.topEdge + (tileBox.tileHeight - maskHeight) / 2;
    return { maskSize: `${maskWidth}px ${maskHeight}px`, maskPosition: `${maskLeft}px ${maskTop}px` };
  });
  return {
    offset: transitionShare,
    maskImage: tileMasks.map(() => fullMaskLayer).join(", "),
    maskSize: tileMasks.map((tileMask) => tileMask.maskSize).join(", "),
    maskPosition: tileMasks.map((tileMask) => tileMask.maskPosition).join(", "),
  };
}

function readSnapshotDuration(snapshotPseudo: string): number {
  return parseFloat(getComputedStyle(document.documentElement, snapshotPseudo).animationDuration) * millisecondsPerSecond;
}

// Mosaic and blinds cut both slide snapshots into tiles with masks: one snapshot cannot be split into moving pieces.
export function maskSlideTiles(chosenTransition: string, slideElement: HTMLElement, isMovingForward: boolean): Animation[] {
  const tileLayout = tileLayouts[chosenTransition];
  if (tileLayout === undefined) return [];
  const tileBoxes = measureTileBoxes(tileLayout, slideElement.offsetWidth, slideElement.offsetHeight, isMovingForward);
  const frameShares = Array.from({ length: keyframeCount + 1 }, (_, framePosition) => framePosition / keyframeCount);
  return [
    { snapshotPseudo: "::view-transition-old(slide-out)", isOutgoing: true },
    { snapshotPseudo: "::view-transition-new(slide-in)", isOutgoing: false },
  ].map(({ snapshotPseudo, isOutgoing }) => {
    const tileAnimation = document.documentElement.animate(
      frameShares.map((transitionShare) => describeTileFrame(tileBoxes, tileLayout, transitionShare, isOutgoing)),
      { duration: readSnapshotDuration(snapshotPseudo), fill: "both", pseudoElement: snapshotPseudo },
    );
    tileAnimation.id = `slidemachina-${chosenTransition}`;
    return tileAnimation;
  });
}
