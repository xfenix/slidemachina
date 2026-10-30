import type { ElkNode, ElkPoint } from "elkjs/lib/elk-api";
import { placeArrowLabel, type LabelFrame } from "./arrow-geometry.ts";
import type { DiagramDirection, MeasuredSize } from "./diagram-graph.ts";
import { layOutWithElk } from "./elk-worker-client.ts";
import { tidyLaidOutGraph } from "./layout-tidying.ts";

const labelDistance = 12;

// Enough for every diagram and step of a long talk; hot reload adds graphs, so the oldest go.
const largestGeometryCount = 300;
// Layouts outlive the page: a talk opened again draws its diagrams at once and never starts ELK.
const storedGeometriesKey = "slidemachina-diagram-layouts";
// The store is shared by every talk opened from the same site or from disk, so it keeps only the latest.
const largestStoredGeometryCount = 50;
const runningLayouts = new Map<string, Promise<DiagramGeometry>>();
let finishedGeometries: Map<string, DiagramGeometry> | undefined;

export type NodeFrame = LabelFrame;
type ArrowRoute = { routePoints: ElkPoint[]; labelFrame?: NodeFrame };
export type DiagramGeometry = {
  diagramWidth: number;
  diagramHeight: number;
  // Relative to the enclosing group, like the boxes inside it on the page; arrows are relative to the whole diagram.
  nodeFrames: Record<string, NodeFrame>;
  arrowRoutes: Record<string, ArrowRoute>;
};

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
    const routePoints = [edgeSection.startPoint, ...(edgeSection.bendPoints ?? []), edgeSection.endPoint].map(turnPoint);
    const labelSize = labelSizes.get(laidOutEdge.id);
    arrowRoutes[laidOutEdge.id] = {
      routePoints,
      labelFrame: labelSize && placeArrowLabel(routePoints, labelSize.width, labelSize.height, flowsRight, labelDistance),
    };
  }
  const diagramSize = turnPoint({ x: laidOutGraph.width ?? 0, y: laidOutGraph.height ?? 0 });
  return { diagramWidth: diagramSize.x, diagramHeight: diagramSize.y, nodeFrames, arrowRoutes };
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
