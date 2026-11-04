import type { ElkNode, ElkPoint } from "elkjs/lib/elk-api";
import { placeArrowLabel, type LabelFrame } from "./arrow-geometry.ts";
import type { DiagramDirection, MeasuredSize } from "./diagram-graph.ts";
import { layOutWithElk } from "./elk-worker-client.ts";
import { tidyLaidOutGraph } from "./layout-tidying.ts";

const labelDistance = 12;

// Enough for every diagram and step of a long talk; hot reload adds graphs, so the oldest go.
const largestGeometryCount = 300;
// Layouts outlive the page: a talk opened again draws its diagrams at once and never starts ELK.
// The key carries a version: routes now keep their raw ELK points for code anchor ends.
const storedGeometriesKey = "slidemachina-diagram-layouts-v2";
// The store is shared by every talk opened from the same site or from disk, so it keeps only the latest.
const largestStoredGeometryCount = 50;
const runningLayouts = new Map<string, Promise<DiagramGeometry>>();
let finishedGeometries: Map<string, DiagramGeometry> | undefined;

export type AnchorPoint = { x: number; y: number };
export type ArrowAnchorEnds = { start?: AnchorPoint; end?: AnchorPoint };
export type NodeFrame = LabelFrame;
type ArrowRoute = {
  routePoints: ElkPoint[];
  // The ELK route before anchor ends: anchors resolve after layout, so a re-measure reapplies them from the raw route.
  rawRoutePoints: ElkPoint[];
  sourceNodeId: string;
  targetNodeId: string;
  labelSize?: MeasuredSize;
  labelFrame?: NodeFrame;
};
export type DiagramGeometry = {
  diagramWidth: number;
  diagramHeight: number;
  flowsRight: boolean;
  // Relative to the enclosing group, like the boxes inside it on the page; arrows are relative to the whole diagram.
  nodeFrames: Record<string, NodeFrame>;
  arrowRoutes: Record<string, ArrowRoute>;
};

function isPointInsideFrame(checkPoint: ElkPoint, nodeFrame: NodeFrame): boolean {
  return (
    checkPoint.x > nodeFrame.x &&
    checkPoint.x < nodeFrame.x + nodeFrame.width &&
    checkPoint.y > nodeFrame.y &&
    checkPoint.y < nodeFrame.y + nodeFrame.height
  );
}

// A named code anchor replaces the box border point; bends inside the node drop out, so the line leaves the text cleanly.
function applyAnchorEnds(
  routePoints: ElkPoint[],
  anchorEnds: ArrowAnchorEnds | undefined,
  sourceFrame: NodeFrame | undefined,
  targetFrame: NodeFrame | undefined,
): ElkPoint[] {
  if (anchorEnds === undefined) return routePoints;
  let adjustedPoints = [...routePoints];
  if (anchorEnds.start !== undefined && sourceFrame !== undefined) {
    adjustedPoints = [anchorEnds.start, ...adjustedPoints.slice(1).filter((routePoint) => !isPointInsideFrame(routePoint, sourceFrame))];
  }
  if (anchorEnds.end !== undefined && targetFrame !== undefined) {
    adjustedPoints = [...adjustedPoints.slice(0, -1).filter((routePoint) => !isPointInsideFrame(routePoint, targetFrame)), anchorEnds.end];
  }
  return adjustedPoints;
}

// Arrow routes are diagram-absolute; a node inside a group adds its frame to every enclosing group's frame.
function describeAbsoluteFrame(
  nodeFrames: Record<string, NodeFrame>,
  enclosingGroups: Map<string, string[]>,
  nodeIdentifier: string,
): NodeFrame | undefined {
  const frameChain = [nodeIdentifier, ...(enclosingGroups.get(nodeIdentifier) ?? [])];
  const absoluteFrame = { x: 0, y: 0, width: 0, height: 0 };
  for (const frameIdentifier of frameChain) {
    const nodeFrame = nodeFrames[frameIdentifier];
    if (nodeFrame === undefined) return undefined;
    absoluteFrame.x += nodeFrame.x;
    absoluteFrame.y += nodeFrame.y;
    absoluteFrame.width = nodeFrame.width;
    absoluteFrame.height = nodeFrame.height;
  }
  return absoluteFrame;
}

// Anchor ends resolve on the laid-out boxes: code auto-fit and ELK placement settle first, then the ends attach to the tokens.
export function applyAnchorEndsToRoutes(
  diagramGeometry: DiagramGeometry,
  anchorEndsByArrow: Map<string, ArrowAnchorEnds>,
  enclosingGroups: Map<string, string[]>,
): DiagramGeometry {
  const arrowRoutes: Record<string, ArrowRoute> = {};
  for (const [arrowIdentifier, arrowRoute] of Object.entries(diagramGeometry.arrowRoutes)) {
    const anchorEnds = anchorEndsByArrow.get(arrowIdentifier);
    if (anchorEnds === undefined) {
      arrowRoutes[arrowIdentifier] = arrowRoute;
      continue;
    }
    // Anchor offsets are box-local and measured in the laid-out (already turned) space, like the node frames.
    const sourceFrame = describeAbsoluteFrame(diagramGeometry.nodeFrames, enclosingGroups, arrowRoute.sourceNodeId);
    const targetFrame = describeAbsoluteFrame(diagramGeometry.nodeFrames, enclosingGroups, arrowRoute.targetNodeId);
    const anchorPoints = {
      start:
        anchorEnds.start === undefined || sourceFrame === undefined
          ? undefined
          : { x: anchorEnds.start.x + sourceFrame.x, y: anchorEnds.start.y + sourceFrame.y },
      end:
        anchorEnds.end === undefined || targetFrame === undefined
          ? undefined
          : { x: anchorEnds.end.x + targetFrame.x, y: anchorEnds.end.y + targetFrame.y },
    };
    const routePoints = applyAnchorEnds(arrowRoute.rawRoutePoints, anchorPoints, sourceFrame, targetFrame);
    arrowRoutes[arrowIdentifier] = {
      ...arrowRoute,
      routePoints,
      labelFrame: arrowRoute.labelSize && placeArrowLabel(routePoints, arrowRoute.labelSize.width, arrowRoute.labelSize.height, diagramGeometry.flowsRight, labelDistance),
    };
  }
  return { ...diagramGeometry, arrowRoutes };
}

function readGeometry(laidOutGraph: ElkNode, labelSizes: Map<string, MeasuredSize>, flowsRight: boolean): DiagramGeometry {
  const turnPoint = ({ x, y }: ElkPoint): ElkPoint => (flowsRight ? { x, y } : { x: y, y: x });
  const nodeFrames: Record<string, NodeFrame> = {};
  const collectFrames = (laidOutNodes: ElkNode[]) => {
    for (const { id, x = 0, y = 0, width = 0, height = 0, children } of laidOutNodes) {
      nodeFrames[id] = flowsRight ? { x, y, width, height } : { x: y, y: x, width: height, height: width };
      collectFrames(children ?? []);
    }
  };
  collectFrames(laidOutGraph.children ?? []);
  const arrowRoutes: Record<string, ArrowRoute> = {};
  for (const laidOutEdge of laidOutGraph.edges ?? []) {
    const edgeSection = laidOutEdge.sections?.[0];
    if (edgeSection === undefined) continue;
    const rawRoutePoints = [edgeSection.startPoint, ...(edgeSection.bendPoints ?? []), edgeSection.endPoint].map(turnPoint);
    const labelSize = labelSizes.get(laidOutEdge.id);
    arrowRoutes[laidOutEdge.id] = {
      routePoints: rawRoutePoints,
      rawRoutePoints,
      sourceNodeId: laidOutEdge.sources[0]!,
      targetNodeId: laidOutEdge.targets[0]!,
      labelSize,
      labelFrame: labelSize && placeArrowLabel(rawRoutePoints, labelSize.width, labelSize.height, flowsRight, labelDistance),
    };
  }
  const diagramSize = turnPoint({ x: laidOutGraph.width ?? 0, y: laidOutGraph.height ?? 0 });
  return { diagramWidth: diagramSize.x, diagramHeight: diagramSize.y, flowsRight, nodeFrames, arrowRoutes };
}

// The navigator and hot reload mount the same diagram again; a known graph is drawn at once, without a flash.
function readFinishedGeometries(): Map<string, DiagramGeometry> {
  if (finishedGeometries !== undefined) return finishedGeometries;
  finishedGeometries = new Map();
  try {
    for (const [graphKey, storedGeometry] of JSON.parse(localStorage.getItem(storedGeometriesKey) ?? "[]") as Array<[string, DiagramGeometry]>) {
      finishedGeometries.set(graphKey, storedGeometry);
    }
  } catch {
    // A broken or blocked store only means ELK lays the diagrams out again.
  }
  return finishedGeometries;
}

function rememberGeometry(graphKey: string, diagramGeometry: DiagramGeometry) {
  const knownGeometries = readFinishedGeometries();
  knownGeometries.set(graphKey, diagramGeometry);
  if (knownGeometries.size > largestGeometryCount) knownGeometries.delete(knownGeometries.keys().next().value!);
  try {
    localStorage.setItem(storedGeometriesKey, JSON.stringify([...knownGeometries].slice(-largestStoredGeometryCount)));
  } catch {
    // A full or blocked store keeps the layouts for this page only.
  }
}

export function findFinishedGeometry(graphKey: string): DiagramGeometry | undefined {
  return readFinishedGeometries().get(graphKey);
}

// Network simplex gives the straightest arrows, but ELK fails on some graphs with it; Brandes-Köpf always works.
function switchToSimplerPlacement(elkGraphNode: ElkNode): ElkNode {
  return {
    ...elkGraphNode,
    layoutOptions: { ...elkGraphNode.layoutOptions, "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF" },
    children: elkGraphNode.children?.map(switchToSimplerPlacement),
  };
}

export function layOutDiagram(
  elkGraph: ElkNode,
  graphKey: string,
  labelSizes: Map<string, MeasuredSize>,
  diagramDirection: DiagramDirection,
): Promise<DiagramGeometry> {
  const runningLayout = runningLayouts.get(graphKey);
  if (runningLayout !== undefined) return runningLayout;
  const placedGraph = layOutWithElk(elkGraph).catch(() => layOutWithElk(switchToSimplerPlacement(elkGraph)));
  const startedLayout = placedGraph.then((laidOutGraph) => {
    const diagramGeometry = readGeometry(tidyLaidOutGraph(laidOutGraph), labelSizes, diagramDirection === "right");
    rememberGeometry(graphKey, diagramGeometry);
    return diagramGeometry;
  });
  // A failed layout is tried again next time instead of failing from the cache.
  void startedLayout.finally(() => runningLayouts.delete(graphKey)).catch(() => {});
  runningLayouts.set(graphKey, startedLayout);
  return startedLayout;
}
