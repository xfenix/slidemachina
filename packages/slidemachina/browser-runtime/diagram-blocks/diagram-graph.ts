import type { ElkExtendedEdge, ElkNode, LayoutOptions } from "elkjs/lib/elk-api";
import { listNodeParts, type ArrowPart, type DiagramPart } from "./diagram-outline.ts";

// Far apart, so ELK's interactive layering reads them only as column and order, never as overlapping shapes.
const positionStride = 10000;
// Labels need more room than nodes, edges less; the title takes part of the group padding.
const labelRoomGapShare = 1.6;
const edgeNodeGapShare = 0.6;
const edgeEdgeGapShare = 0.5;
const titleSpacePaddingShare = 0.75;

export type DiagramDirection = "right" | "down";
export type MeasuredSize = { width: number; height: number };
type DiagramMeasurements = {
  boxSizes: Map<string, MeasuredSize>;
  groupTitleSizes: Map<string, MeasuredSize>;
  arrowLabelSizes: Map<string, MeasuredSize>;
  // From CSS variables, so a theme can loosen or tighten the diagram.
  nodeGap: number;
  columnGap: number;
  groupPadding: number;
};

// Columns come from the markup as fixed positions; ELK skips labels in this mode, so they are placed afterwards.
function describeLevelOptions(measurements: DiagramMeasurements, diagramDirection: DiagramDirection): LayoutOptions {
  const labelSizes = [...measurements.arrowLabelSizes.values()];
  const labelRoom = diagramDirection === "right"
    ? Math.max(0, ...labelSizes.map((labelSize) => labelSize.width + measurements.nodeGap * labelRoomGapShare))
    : Math.max(0, ...labelSizes.map((labelSize) => labelSize.height + measurements.nodeGap * labelRoomGapShare));
  return {
    "elk.layered.layering.strategy": "INTERACTIVE",
    "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
    "elk.layered.cycleBreaking.strategy": "INTERACTIVE",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.spacing.nodeNode": String(measurements.nodeGap),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(Math.max(measurements.columnGap, labelRoom)),
    "elk.spacing.edgeNode": String(measurements.nodeGap * edgeNodeGapShare),
    "elk.layered.spacing.edgeNodeBetweenLayers": String(measurements.nodeGap * edgeNodeGapShare),
    "elk.spacing.edgeEdge": String(measurements.nodeGap * edgeEdgeGapShare),
    "elk.layered.spacing.edgeEdgeBetweenLayers": String(measurements.nodeGap * edgeEdgeGapShare),
  };
}

// Blocks of one column share their width, so the column reads as one tidy stack; the whole diagram shares one height.
function evenOutBoxSizes(diagramParts: DiagramPart[], columnNumbers: Map<string, number>, boxSizes: Map<string, MeasuredSize>) {
  const sizesByColumn = new Map<number, MeasuredSize[]>();
  for (const nodePart of listNodeParts(diagramParts)) {
    if (nodePart.partKind === "group") {
      evenOutBoxSizes(nodePart.innerParts, columnNumbers, boxSizes);
      continue;
    }
    const measuredBoxSize = boxSizes.get(nodePart.nodeIdentifier);
    const columnNumber = columnNumbers.get(nodePart.nodeIdentifier) ?? 0;
    if (measuredBoxSize !== undefined) sizesByColumn.set(columnNumber, [...(sizesByColumn.get(columnNumber) ?? []), measuredBoxSize]);
  }
  for (const columnSizes of sizesByColumn.values()) {
    const sharedWidth = Math.max(...columnSizes.map((columnSize) => columnSize.width));
    for (const columnSize of columnSizes) columnSize.width = sharedWidth;
  }
}

// ELK always lays out to the right: with groups, its downward layout breaks arrows into slants. A downward diagram is turned afterwards.
export function buildElkGraph(
  diagramParts: DiagramPart[],
  drawnArrows: ArrowPart[],
  columnNumbers: Map<string, number>,
  diagramDirection: DiagramDirection,
  measurements: DiagramMeasurements,
): ElkNode {
  const boxSizes = new Map([...measurements.boxSizes].map(([boxIdentifier, measuredBoxSize]) => [boxIdentifier, { ...measuredBoxSize }]));
  evenOutBoxSizes(diagramParts, columnNumbers, boxSizes);
  const sharedHeight = Math.max(0, ...[...boxSizes.values()].map((measuredBoxSize) => measuredBoxSize.height));
  for (const measuredBoxSize of boxSizes.values()) measuredBoxSize.height = sharedHeight;
  const levelOptions = describeLevelOptions(measurements, diagramDirection);
  const flowsRight = diagramDirection === "right";
  const turnSize = (shapeSize: MeasuredSize) => (flowsRight ? shapeSize : { width: shapeSize.height, height: shapeSize.width });
  let markupOrder = 0;
  const describeNodes = (levelParts: DiagramPart[]): ElkNode[] =>
    listNodeParts(levelParts).map((nodePart) => {
      markupOrder += 1;
      const flowPosition = (columnNumbers.get(nodePart.nodeIdentifier) ?? 0) * positionStride;
      const crossPosition = markupOrder * positionStride;
      const givenPosition = { x: flowPosition, y: crossPosition };
      if (nodePart.partKind === "box") return { id: nodePart.nodeIdentifier, ...givenPosition, ...turnSize(boxSizes.get(nodePart.nodeIdentifier)!) };
      const titleSize = measurements.groupTitleSizes.get(nodePart.nodeIdentifier) ?? { width: 0, height: 0 };
      const { groupPadding } = measurements;
      const titleSpace = titleSize.height > 0 ? titleSize.height + groupPadding * titleSpacePaddingShare : 0;
      const titleSide = flowsRight ? "top" : "left";
      const groupMinimum = turnSize({ width: titleSize.width + groupPadding * 2, height: 0 });
      return {
        id: nodePart.nodeIdentifier,
        ...givenPosition,
        layoutOptions: {
          ...levelOptions,
          "elk.padding": `[top=${titleSide === "top" ? groupPadding + titleSpace : groupPadding},left=${titleSide === "left" ? groupPadding + titleSpace : groupPadding},bottom=${groupPadding},right=${groupPadding}]`,
          "elk.nodeSize.constraints": "MINIMUM_SIZE",
          "elk.nodeSize.minimum": `(${groupMinimum.width}, ${groupMinimum.height})`,
        },
        children: describeNodes(nodePart.innerParts),
      };
    });
  const elkEdges: ElkExtendedEdge[] = drawnArrows.map(({ arrowIdentifier, arrowProperties }) => ({
    id: arrowIdentifier,
    sources: [arrowProperties.from],
    targets: [arrowProperties.to],
  }));
  return {
    id: "diagram:root",
    layoutOptions: {
      ...levelOptions,
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.json.edgeCoords": "ROOT",
      "elk.separateConnectedComponents": "false",
      "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    },
    children: describeNodes(diagramParts),
    edges: elkEdges,
  };
}
