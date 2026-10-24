import { useLayoutEffect, useState, type RefObject } from "react";
import { assignDiagramColumns } from "./diagram-columns.ts";
import { listArrowParts, mapEnclosingGroups, type ArrowPart, type DiagramPart } from "./diagram-outline.ts";
import { buildElkGraph, type DiagramDirection, type MeasuredSize } from "./diagram-graph.ts";
import { findFinishedGeometry, layOutDiagram, type DiagramGeometry } from "./diagram-layout.ts";
import { useHeavyPartsAllowed } from "../../presentation-core/heavy-part-loading.ts";
import { pickInterfaceTexts } from "../../presentation-interface/interface-texts.ts";

type DiagramLayoutInput = {
  diagramParts: DiagramPart[];
  drawnArrows: ArrowPart[];
  groupChains: Map<string, string[]>;
  columnNumbers: Map<string, number>;
};

// An arrow to a block that is not on the diagram is left out; ELK would refuse the whole graph.
export function prepareDiagramLayout(diagramParts: DiagramPart[]): DiagramLayoutInput {
  const groupChains = mapEnclosingGroups(diagramParts);
  const drawnArrows = listArrowParts(diagramParts).filter(({ arrowProperties }) => {
    const missingEnd = [arrowProperties.from, arrowProperties.to].find((endIdentifier) => !groupChains.has(endIdentifier));
    if (missingEnd !== undefined) console.warn(pickInterfaceTexts(document.documentElement.lang).missingArrowEnd(missingEnd));
    return missingEnd === undefined;
  });
  return { diagramParts, drawnArrows, groupChains, columnNumbers: assignDiagramColumns(diagramParts, drawnArrows, groupChains) };
}

function measureRenderedSize(measuredElement: Element): MeasuredSize {
  const { offsetWidth, offsetHeight } = measuredElement as HTMLElement;
  return { width: offsetWidth, height: offsetHeight };
}

// The box keeps its laid-out size, so it is measured through its label: label plus padding, at least the minimum width.
function measureBox(boxElement: HTMLElement): MeasuredSize {
  const labelSize = measureRenderedSize(boxElement.querySelector("[data-box-label]")!);
  const boxStyle = getComputedStyle(boxElement);
  const readPixels = (propertyValue: string) => Number.parseFloat(propertyValue) || 0;
  const horizontalPadding = readPixels(boxStyle.paddingLeft) + readPixels(boxStyle.paddingRight) + readPixels(boxStyle.borderLeftWidth) * 2;
  const verticalPadding = readPixels(boxStyle.paddingTop) + readPixels(boxStyle.paddingBottom) + readPixels(boxStyle.borderTopWidth) * 2;
  return {
    width: Math.max(readPixels(boxStyle.minWidth), labelSize.width + horizontalPadding),
    height: labelSize.height + verticalPadding,
  };
}

function measureParts(diagramElement: HTMLElement, selector: string, identifierAttribute: string, measurePart: (partElement: HTMLElement) => MeasuredSize) {
  return new Map(
    [...diagramElement.querySelectorAll<HTMLElement>(selector)].map((partElement) => [
      partElement.closest<HTMLElement>(`[${identifierAttribute}]`)!.getAttribute(identifierAttribute)!,
      measurePart(partElement),
    ]),
  );
}

function measureDiagram(diagramElement: HTMLElement) {
  const diagramStyle = getComputedStyle(diagramElement);
  const readVariable = (variableName: string) => Number.parseFloat(diagramStyle.getPropertyValue(variableName)) || 0;
  return {
    boxSizes: measureParts(diagramElement, "[data-box]", "data-node-id", measureBox),
    groupTitleSizes: measureParts(diagramElement, "[data-group-title]", "data-node-id", measureRenderedSize),
    arrowLabelSizes: measureParts(diagramElement, "[data-arrow-label]", "data-arrow-id", measureRenderedSize),
    nodeGap: readVariable("--diagram-node-gap"),
    columnGap: readVariable("--diagram-column-gap"),
    groupPadding: readVariable("--diagram-group-padding"),
  };
}

// Sizes come from the real text in the slide's fonts; ELK then places every part at once, hidden steps included.
export function useDiagramGeometry(
  diagramElementReference: RefObject<HTMLElement | null>,
  layoutInput: DiagramLayoutInput,
  diagramDirection: DiagramDirection,
): DiagramGeometry | undefined {
  const [diagramGeometry, setDiagramGeometry] = useState<DiagramGeometry>();
  const isLayoutAllowed = useHeavyPartsAllowed();
  useLayoutEffect(() => {
    if (!isLayoutAllowed) return;
    let isOutdated = false;
    const startLayout = () => {
      const diagramElement = diagramElementReference.current;
      if (isOutdated || diagramElement === null) return;
      const { diagramParts, drawnArrows, columnNumbers } = layoutInput;
      const measurements = measureDiagram(diagramElement);
      const elkGraph = buildElkGraph(diagramParts, drawnArrows, columnNumbers, diagramDirection, measurements);
      const graphKey = JSON.stringify([diagramDirection, elkGraph, [...measurements.arrowLabelSizes]]);
      const finishedGeometry = findFinishedGeometry(graphKey);
      if (finishedGeometry !== undefined) {
        setDiagramGeometry(finishedGeometry);
        return;
      }
      layOutDiagram(elkGraph, graphKey, measurements.arrowLabelSizes, diagramDirection).then(
        (laidOutGeometry) => isOutdated || setDiagramGeometry(laidOutGeometry),
        (layoutError) => {
          console.error(layoutError);
          // The PDF waits until every diagram is laid out or has failed.
          if (!isOutdated) diagramElement.setAttribute("data-layout-failed", "");
        },
      );
    };
    if (document.fonts.status === "loaded") startLayout();
    else void document.fonts.ready.then(startLayout);
    return () => {
      isOutdated = true;
    };
  }, [diagramElementReference, layoutInput, diagramDirection, isLayoutAllowed]);
  return diagramGeometry;
}
