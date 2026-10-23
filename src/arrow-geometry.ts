import type { ElkPoint } from "elkjs/lib/elk-api";

type ArrowDrawing = { linePath: string; headPath: string };

export const arrowHeadLength = 15;
export const arrowHeadWidth = 13;

function measureDistance(startPoint: ElkPoint, endPoint: ElkPoint): number {
  return Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
}

function moveToward(startPoint: ElkPoint, endPoint: ElkPoint, travelDistance: number): ElkPoint {
  const segmentLength = measureDistance(startPoint, endPoint) || 1;
  return {
    x: startPoint.x + ((endPoint.x - startPoint.x) * travelDistance) / segmentLength,
    y: startPoint.y + ((endPoint.y - startPoint.y) * travelDistance) / segmentLength,
  };
}

function formatPoint(drawnPoint: ElkPoint): string {
  return `${Math.round(drawnPoint.x * 10) / 10},${Math.round(drawnPoint.y * 10) / 10}`;
}

// Corners round off at most half the shorter segment; the line ends inside the head, not past its tip.
export function drawArrow(routePoints: ElkPoint[], cornerRadius: number): ArrowDrawing {
  const tipPoint = routePoints.at(-1)!;
  const beforeTipPoint = routePoints.at(-2) ?? tipPoint;
  const lineEndPoint = moveToward(tipPoint, beforeTipPoint, arrowHeadLength * 0.7);
  const linePoints = [...routePoints.slice(0, -1), lineEndPoint];
  let linePath = `M${formatPoint(linePoints[0])}`;
  for (let pointPosition = 1; pointPosition < linePoints.length - 1; pointPosition += 1) {
    const previousPoint = linePoints[pointPosition - 1];
    const bendPoint = linePoints[pointPosition];
    const nextPoint = linePoints[pointPosition + 1];
    const bendRadius = Math.min(cornerRadius, measureDistance(previousPoint, bendPoint) / 2, measureDistance(bendPoint, nextPoint) / 2);
    linePath += ` L${formatPoint(moveToward(bendPoint, previousPoint, bendRadius))}`;
    linePath += ` Q${formatPoint(bendPoint)} ${formatPoint(moveToward(bendPoint, nextPoint, bendRadius))}`;
  }
  linePath += ` L${formatPoint(lineEndPoint)}`;

  const headBase = moveToward(tipPoint, beforeTipPoint, arrowHeadLength);
  const headNotch = moveToward(tipPoint, beforeTipPoint, arrowHeadLength * 0.75);
  const headSideX = ((tipPoint.y - headBase.y) / arrowHeadLength) * (arrowHeadWidth / 2);
  const headSideY = ((headBase.x - tipPoint.x) / arrowHeadLength) * (arrowHeadWidth / 2);
  const headPath = [
    `M${formatPoint(tipPoint)}`,
    `L${formatPoint({ x: headBase.x + headSideX, y: headBase.y + headSideY })}`,
    `L${formatPoint(headNotch)}`,
    `L${formatPoint({ x: headBase.x - headSideX, y: headBase.y - headSideY })}`,
    "Z",
  ].join(" ");
  return { linePath, headPath };
}

export type LabelFrame = { x: number; y: number; width: number; height: number };

// The label sits on the longest straight run across the flow; columns are spaced to fit it.
export function placeArrowLabel(routePoints: ElkPoint[], labelWidth: number, labelHeight: number, flowsRight: boolean, labelDistance: number): LabelFrame {
  const routeSegments = routePoints.slice(1).map((endPoint, segmentPosition) => ({ startPoint: routePoints[segmentPosition], endPoint }));
  const runsAlongFlow = (startPoint: ElkPoint, endPoint: ElkPoint) => (flowsRight ? startPoint.y === endPoint.y : startPoint.x === endPoint.x);
  const preferredSegments = routeSegments.filter(({ startPoint, endPoint }) => runsAlongFlow(startPoint, endPoint));
  const candidateSegments = preferredSegments.length > 0 ? preferredSegments : routeSegments;
  const { startPoint, endPoint } = candidateSegments.reduce((longestSegment, routeSegment) =>
    measureDistance(routeSegment.startPoint, routeSegment.endPoint) > measureDistance(longestSegment.startPoint, longestSegment.endPoint) ? routeSegment : longestSegment,
  );
  const middlePoint = { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 };
  if (flowsRight) return { x: middlePoint.x - labelWidth / 2, y: middlePoint.y - labelDistance - labelHeight, width: labelWidth, height: labelHeight };
  return { x: middlePoint.x + labelDistance, y: middlePoint.y - labelHeight / 2, width: labelWidth, height: labelHeight };
}
