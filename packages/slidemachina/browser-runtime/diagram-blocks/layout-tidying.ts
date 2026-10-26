import type { ElkNode, ElkPoint } from "elkjs/lib/elk-api";

// Positions closer than this are one line: ELK coordinates carry rounding noise.
const sameLineTolerance = 0.5;

type PlacedFrame = { left: number; top: number; right: number; bottom: number };
type CrossingRun = { routePoints: ElkPoint[]; pointPosition: number; gapLeft: number; gapRight: number };

function listPlacedFrames(laidOutNodes: ElkNode[], originX = 0, originY = 0): PlacedFrame[] {
  return laidOutNodes.flatMap(({ x = 0, y = 0, width = 0, height = 0, children }) => [
    { left: originX + x, top: originY + y, right: originX + x + width, bottom: originY + y + height },
    ...listPlacedFrames(children ?? [], originX + x, originY + y),
  ]);
}

// Groups side by side start on one line: a lower group grows upwards, its boxes stay where ELK put them.
function alignGroupTops(containerNode: ElkNode) {
  const childNodes = containerNode.children ?? [];
  const groupNodes = childNodes.filter((childNode) => (childNode.children ?? []).length > 0);
  const raisedTops = new Map<ElkNode, number>();
  for (const groupNode of groupNodes) {
    const groupTop = groupNode.y ?? 0;
    const groupBottom = groupTop + (groupNode.height ?? 0);
    const groupLeft = groupNode.x ?? 0;
    const groupRight = groupLeft + (groupNode.width ?? 0);
    const besideTops = groupNodes
      .filter((otherNode) => otherNode !== groupNode && (otherNode.y ?? 0) < groupBottom && (otherNode.y ?? 0) + (otherNode.height ?? 0) > groupTop)
      .map((otherNode) => otherNode.y ?? 0);
    const sharedTop = Math.min(groupTop, ...besideTops);
    const blocksGrowth = childNodes.some(
      (otherNode) =>
        otherNode !== groupNode &&
        (otherNode.x ?? 0) < groupRight &&
        (otherNode.x ?? 0) + (otherNode.width ?? 0) > groupLeft &&
        (otherNode.y ?? 0) + (otherNode.height ?? 0) > sharedTop &&
        (otherNode.y ?? 0) < groupTop,
    );
    if (sharedTop < groupTop && !blocksGrowth) raisedTops.set(groupNode, sharedTop);
  }
  for (const [groupNode, sharedTop] of raisedTops) {
    const growth = (groupNode.y ?? 0) - sharedTop;
    groupNode.y = sharedTop;
    groupNode.height = (groupNode.height ?? 0) + growth;
    for (const innerNode of groupNode.children ?? []) innerNode.y = (innerNode.y ?? 0) + growth;
  }
  for (const childNode of childNodes) alignGroupTops(childNode);
}

// The free gap a run across the flow can move in: from the nearest edge of a box or group on its left to the nearest on its right.
function findCrossingRuns(routePoints: ElkPoint[], placedFrames: PlacedFrame[]): CrossingRun[] {
  const crossingRuns: CrossingRun[] = [];
  for (let pointPosition = 1; pointPosition < routePoints.length - 2; pointPosition += 1) {
    const [beforePoint, runStart, runEnd, afterPoint] = routePoints.slice(pointPosition - 1, pointPosition + 3) as [ElkPoint, ElkPoint, ElkPoint, ElkPoint];
    const isCrossing =
      Math.abs(runStart.x - runEnd.x) < sameLineTolerance &&
      Math.abs(beforePoint.y - runStart.y) < sameLineTolerance &&
      Math.abs(afterPoint.y - runEnd.y) < sameLineTolerance &&
      beforePoint.x < runStart.x &&
      afterPoint.x > runStart.x;
    if (!isCrossing) continue;
    const runTop = Math.min(runStart.y, runEnd.y);
    const runBottom = Math.max(runStart.y, runEnd.y);
    const frameEdges = placedFrames
      .filter((placedFrame) => placedFrame.top <= runBottom && placedFrame.bottom >= runTop)
      .flatMap((placedFrame) => [placedFrame.left, placedFrame.right]);
    crossingRuns.push({
      routePoints,
      pointPosition,
      gapLeft: Math.max(beforePoint.x, ...frameEdges.filter((frameEdge) => frameEdge <= runStart.x)),
      gapRight: Math.min(afterPoint.x, ...frameEdges.filter((frameEdge) => frameEdge >= runStart.x)),
    });
  }
  return crossingRuns;
}

// ELK bends an arrow right after its source; the bend goes to the middle of the gap. Runs sharing a gap move together.
function centerArrowBends(laidOutGraph: ElkNode) {
  const placedFrames = listPlacedFrames(laidOutGraph.children ?? []);
  const crossingRuns = (laidOutGraph.edges ?? []).flatMap((laidOutEdge) => {
    const edgeSection = laidOutEdge.sections?.[0];
    if (edgeSection?.bendPoints === undefined) return [];
    return findCrossingRuns([edgeSection.startPoint, ...edgeSection.bendPoints, edgeSection.endPoint], placedFrames);
  });
  const runsByGap = new Map<string, CrossingRun[]>();
  for (const crossingRun of crossingRuns) {
    const gapKey = `${Math.round(crossingRun.gapLeft)}:${Math.round(crossingRun.gapRight)}`;
    runsByGap.set(gapKey, [...(runsByGap.get(gapKey) ?? []), crossingRun]);
  }
  for (const gapRuns of runsByGap.values()) {
    const runPositions = gapRuns.map(({ routePoints, pointPosition }) => routePoints[pointPosition]!.x);
    const gapShift = (gapRuns[0]!.gapLeft + gapRuns[0]!.gapRight) / 2 - (Math.min(...runPositions) + Math.max(...runPositions)) / 2;
    for (const { routePoints, pointPosition } of gapRuns) {
      routePoints[pointPosition]!.x += gapShift;
      routePoints[pointPosition + 1]!.x += gapShift;
    }
  }
}

// Works on ELK's own coordinates, where the flow always runs to the right.
export function tidyLaidOutGraph(laidOutGraph: ElkNode): ElkNode {
  alignGroupTops(laidOutGraph);
  centerArrowBends(laidOutGraph);
  return laidOutGraph;
}
