import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import type { ElkPoint } from "elkjs/lib/elk-api";
import { drawArrow } from "./arrow-geometry.ts";
import { useFocusSteps } from "./diagram-focus.ts";
import type { DiagramDirection } from "./diagram-graph.ts";
import type { DiagramGeometry, NodeFrame } from "./diagram-layout.ts";
import { prepareDiagramLayout, useDiagramGeometry } from "./diagram-measuring.ts";
import { outlineDiagramParts, type ArrowPart, type DiagramPart } from "./diagram-outline.ts";
import { createPartStepAttributes, FocusMarker } from "./diagram-parts.tsx";
import { useDiagramScaling } from "./diagram-scaling.ts";
import { pickSourceMarks } from "./source-marks.ts";

export type DiagramProperties = {
  children?: ReactNode;
  direction?: DiagramDirection;
};

type DrawingContext = {
  diagramGeometry: DiagramGeometry | undefined;
  groupChains: Map<string, string[]>;
  columnNumbers: Map<string, number>;
  drawnArrowIdentifiers: Set<string>;
  // Where the enclosing group sits in the diagram: arrows are routed in diagram coordinates.
  containerOrigin: ElkPoint;
};

const arrowCornerRadius = 16;

function placeFrame(nodeFrame: NodeFrame | undefined): CSSProperties | undefined {
  if (nodeFrame === undefined) return undefined;
  return { left: nodeFrame.x, top: nodeFrame.y, width: nodeFrame.width, height: nodeFrame.height };
}

function DiagramArrow({ arrowPart, drawingContext }: { arrowPart: ArrowPart; drawingContext: DrawingContext }) {
  const { arrowIdentifier, arrowProperties } = arrowPart;
  const { diagramGeometry, containerOrigin } = drawingContext;
  const arrowRoute = diagramGeometry?.arrowRoutes[arrowIdentifier];
  const arrowDrawing = arrowRoute && drawArrow(arrowRoute.routePoints, arrowCornerRadius);
  const labelFrame = arrowRoute?.labelFrame;
  const arrowStyle = {
    left: -containerOrigin.x,
    top: -containerOrigin.y,
    width: diagramGeometry?.diagramWidth,
    height: diagramGeometry?.diagramHeight,
  };
  return (
    <div
      data-arrow
      data-morph-apart
      data-arrow-id={arrowIdentifier}
      data-focus-id={arrowProperties.id ?? arrowIdentifier}
      data-focus-ends={`${arrowProperties.from} ${arrowProperties.to}`}
      style={arrowStyle}
      {...createPartStepAttributes(arrowProperties.step, arrowProperties.effect, "fade")}
    >
      {arrowDrawing !== undefined && diagramGeometry !== undefined && (
        <svg width={diagramGeometry.diagramWidth} height={diagramGeometry.diagramHeight} aria-hidden>
          <path data-arrow-line d={arrowDrawing.linePath} pathLength={1} />
          <path data-arrow-head d={arrowDrawing.headPath} />
        </svg>
      )}
      {arrowProperties.label !== undefined && (
        <span data-arrow-label style={labelFrame && { left: labelFrame.x, top: labelFrame.y }}>
          {arrowProperties.label}
        </span>
      )}
    </div>
  );
}

// Markup order is drawing order; matching ids such as "diagram-node:api" morph between slides.
function drawDiagramParts(diagramParts: DiagramPart[], drawingContext: DrawingContext): ReactNode[] {
  return diagramParts.map((diagramPart, partPosition) => {
    if (diagramPart.partKind === "focus") return <FocusMarker key={partPosition} focusProperties={diagramPart.focusProperties} />;
    if (diagramPart.partKind === "arrow") {
      if (!drawingContext.drawnArrowIdentifiers.has(diagramPart.arrowIdentifier)) return null;
      return <DiagramArrow key={partPosition} arrowPart={diagramPart} drawingContext={drawingContext} />;
    }
    const { nodeIdentifier } = diagramPart;
    const nodeFrame = drawingContext.diagramGeometry?.nodeFrames[nodeIdentifier];
    const focusAttributes = {
      "data-node-id": nodeIdentifier,
      "data-focus-id": nodeIdentifier,
      "data-focus-groups": drawingContext.groupChains.get(nodeIdentifier)?.join(" "),
      // Counted from 1, like column={n}: the editor snaps a dragged box to these columns.
      "data-flow-column": (drawingContext.columnNumbers.get(nodeIdentifier) ?? 0) + 1,
    };
    if (diagramPart.partKind === "box") {
      const { boxProperties } = diagramPart;
      return (
        <div
          key={partPosition}
          data-box
          morph={`diagram-node:${nodeIdentifier}`}
          style={placeFrame(nodeFrame)}
          {...focusAttributes}
          {...pickSourceMarks(boxProperties)}
          {...createPartStepAttributes(boxProperties.step, boxProperties.effect, "rise")}
        >
          <span data-box-label data-morph-text morph={`diagram-node-label:${nodeIdentifier}`}>
            {boxProperties.children}
          </span>
        </div>
      );
    }
    const { groupProperties, innerParts } = diagramPart;
    const innerOrigin = {
      x: drawingContext.containerOrigin.x + (nodeFrame?.x ?? 0),
      y: drawingContext.containerOrigin.y + (nodeFrame?.y ?? 0),
    };
    return (
      <div
        key={partPosition}
        data-group
        morph={`diagram-group:${nodeIdentifier}`}
        style={placeFrame(nodeFrame)}
        {...focusAttributes}
        {...pickSourceMarks(groupProperties)}
        {...createPartStepAttributes(groupProperties.step, groupProperties.effect, "fade")}
      >
        <div data-group-frame />
        {groupProperties.title !== undefined && (
          <span data-group-title data-morph-text morph={`diagram-group-title:${nodeIdentifier}`}>
            {groupProperties.title}
          </span>
        )}
        {drawDiagramParts(innerParts, { ...drawingContext, containerOrigin: innerOrigin })}
      </div>
    );
  });
}

export function Diagram({ children, direction = "right" }: DiagramProperties) {
  const figureElementReference = useRef<HTMLElement>(null);
  const layoutInput = useMemo(() => prepareDiagramLayout(outlineDiagramParts(children)), [children]);
  const diagramGeometry = useDiagramGeometry(figureElementReference, layoutInput, direction);
  const diagramWidth = diagramGeometry?.diagramWidth ?? 0;
  const diagramHeight = diagramGeometry?.diagramHeight ?? 0;
  useDiagramScaling(figureElementReference, diagramWidth, diagramHeight);
  useFocusSteps(figureElementReference);

  const drawingContext: DrawingContext = {
    diagramGeometry,
    groupChains: layoutInput.groupChains,
    columnNumbers: layoutInput.columnNumbers,
    drawnArrowIdentifiers: new Set(layoutInput.drawnArrows.map((drawnArrow) => drawnArrow.arrowIdentifier)),
    containerOrigin: { x: 0, y: 0 },
  };
  const sizeStyle = diagramGeometry && ({ "--diagram-width": diagramWidth, "--diagram-height": diagramHeight } as CSSProperties);
  return (
    <figure ref={figureElementReference} data-diagram data-direction={direction} data-laid-out={diagramGeometry !== undefined || undefined} style={sizeStyle}>
      <div data-diagram-stage>{drawDiagramParts(layoutInput.diagramParts, drawingContext)}</div>
    </figure>
  );
}
