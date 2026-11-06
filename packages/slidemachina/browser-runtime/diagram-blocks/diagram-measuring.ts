import { useLayoutEffect, useState, type RefObject } from "react";
import { isCodeAnchorEndpoint, readArrowNodeIdentifier, type ArrowEndpoint } from "./arrow-endpoints.ts";
import { assignDiagramColumns } from "./diagram-columns.ts";
import { listArrowParts, mapEnclosingGroups, type ArrowPart, type DiagramPart } from "./diagram-outline.ts";
import { buildElkGraph, type DiagramDirection, type MeasuredSize } from "./diagram-graph.ts";
import { findFinishedGeometry, layOutDiagram, applyAnchorEndsToRoutes, type DiagramGeometry } from "./diagram-layout.ts";
import { useHeavyPartsAllowed } from "../presentation-core/heavy-part-loading.ts";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";

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
    const missingEnd = [arrowProperties.from, arrowProperties.to]
      .map(readArrowNodeIdentifier)
      .find((endIdentifier) => !groupChains.has(endIdentifier));
    if (missingEnd !== undefined) console.warn(pickInterfaceTexts(document.documentElement.lang).missingArrowEnd(missingEnd));
    return missingEnd === undefined;
  });
  return { diagramParts, drawnArrows, groupChains, columnNumbers: assignDiagramColumns(diagramParts, drawnArrows, groupChains) };
}

function measureRenderedSize(measuredElement: Element): MeasuredSize {
  const { offsetWidth, offsetHeight } = measuredElement as HTMLElement;
  return { width: offsetWidth, height: offsetHeight };
}

type CodeAnchorSpecification = { line: number; columns?: [number, number] };
export type AnchorPoint = { x: number; y: number };
type ArrowAnchorEnds = { start?: AnchorPoint; end?: AnchorPoint };

// Columns are 1-based positions in the source line, the end column is exclusive; without columns the whole line is the anchor.
function measureAnchorPoint(boxElement: HTMLElement, anchorEndpoint: { code: string; anchor: string }): AnchorPoint | undefined {
  const codeElement = boxElement.querySelector<HTMLElement>(`[data--slidemachina-code-id="${anchorEndpoint.code}"]`);
  const anchorSpecifications = codeElement === null ? undefined : JSON.parse(codeElement.getAttribute("data--slidemachina-code-anchors") ?? "{}") as Record<string, CodeAnchorSpecification>;
  const anchorSpecification = anchorSpecifications?.[anchorEndpoint.anchor];
  if (codeElement === null || anchorSpecification === undefined) {
    console.error(`slidemachina: an arrow points at the anchor "${anchorEndpoint.anchor}" of the code block "${anchorEndpoint.code}", and there is no such anchor.`);
    return undefined;
  }
  const lineElement = codeElement.querySelector<HTMLElement>(`[data-code-line="${anchorSpecification.line}"]`);
  if (lineElement === null) {
    console.error(`slidemachina: the anchor "${anchorEndpoint.anchor}" names the line ${anchorSpecification.line}, and the code block "${anchorEndpoint.code}" has no such line.`);
    return undefined;
  }
  const lineText = lineElement.textContent;
  const range = document.createRange();
  if (anchorSpecification.columns === undefined) {
    range.selectNodeContents(lineElement);
  } else {
    const [startColumn, endColumn] = anchorSpecification.columns;
    const startOffset = Math.max(0, Math.min(startColumn - 1, lineText.length));
    const endOffset = Math.max(startOffset, Math.min(endColumn - 1, lineText.length));
    range.setStart(lineElement.firstChild ?? lineElement, 0);
    range.setEnd(lineElement.firstChild ?? lineElement, 0);
    // Walk the text nodes of the line to the requested character offsets, whatever tokens they sit in.
    let walkedLength = 0;
    let startSet = false;
    const textWalker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT);
    while (textWalker.nextNode()) {
      const textNode = textWalker.currentNode;
      const nodeEnd = walkedLength + (textNode.textContent ?? "").length;
      if (!startSet && nodeEnd >= startOffset) {
        range.setStart(textNode, startOffset - walkedLength);
        startSet = true;
      }
      if (startSet && nodeEnd >= endOffset) {
        range.setEnd(textNode, endOffset - walkedLength);
        break;
      }
      walkedLength = nodeEnd;
    }
  }
  // A wrapped anchor attaches to its first visible fragment: deterministic and always on screen.
  const anchorRectangle = range.getClientRects()[0] ?? range.getBoundingClientRect();
  range.detach();
  if (anchorRectangle.width === 0 && anchorRectangle.height === 0) return undefined;
  // The stage scales to fit the slide: rectangles come back scaled, offsets must be diagram units again.
  const stageElement = boxElement.closest<HTMLElement>("[data-diagram-stage]")!;
  const stageRectangle = stageElement.getBoundingClientRect();
  const stageScale = stageRectangle.width / stageElement.offsetWidth || 1;
  const boxRectangle = boxElement.getBoundingClientRect();
  return {
    x: (anchorRectangle.left + anchorRectangle.width / 2 - boxRectangle.left) / stageScale,
    y: (anchorRectangle.top + anchorRectangle.height / 2 - boxRectangle.top) / stageScale,
  };
}

function measureArrowAnchorEnds(diagramElement: HTMLElement, drawnArrows: ArrowPart[]): Map<string, ArrowAnchorEnds> {
  const anchorEnds = new Map<string, ArrowAnchorEnds>();
  for (const { arrowIdentifier, arrowProperties } of drawnArrows) {
    const measureEnd = (arrowEndpoint: ArrowEndpoint) => {
      if (!isCodeAnchorEndpoint(arrowEndpoint)) return undefined;
      const boxElement = diagramElement.querySelector<HTMLElement>(`[data-node-id="${arrowEndpoint.node}"]`);
      if (boxElement === null) {
        console.error(`slidemachina: an arrow points at the code block "${arrowEndpoint.code}" of the node "${arrowEndpoint.node}", and that node has no code block.`);
        return undefined;
      }
      return measureAnchorPoint(boxElement, arrowEndpoint);
    };
    const start = measureEnd(arrowProperties.from);
    const end = measureEnd(arrowProperties.to);
    if (start !== undefined || end !== undefined) anchorEnds.set(arrowIdentifier, { start, end });
  }
  return anchorEnds;
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
  const [rawDiagramGeometry, setRawDiagramGeometry] = useState<DiagramGeometry>();
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
        setRawDiagramGeometry(finishedGeometry);
        return;
      }
      layOutDiagram(elkGraph, graphKey, measurements.arrowLabelSizes, diagramDirection).then(
        (laidOutGeometry) => isOutdated || setRawDiagramGeometry(laidOutGeometry),
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
  // Anchor ends resolve on the laid-out boxes: ELK placement and code auto-fit settle, then the ends attach to the tokens.
  // The observer fires on its own once, and again whenever the stage is resized or refitted.
  useLayoutEffect(() => {
    if (rawDiagramGeometry === undefined) return;
    const diagramElement = diagramElementReference.current;
    if (diagramElement === null) return;
    const layoutObserver = new ResizeObserver(() => {
      const anchorEnds = measureArrowAnchorEnds(diagramElement, layoutInput.drawnArrows);
      // A test and the print view read the attribute: arrows attach only after this pass.
      diagramElement.toggleAttribute("data--slidemachina-anchors-attached", anchorEnds.size > 0);
      setDiagramGeometry(applyAnchorEndsToRoutes(rawDiagramGeometry, anchorEnds, layoutInput.groupChains));
    });
    const observedElements = [diagramElement, diagramElement.querySelector("[data-diagram-stage]"), diagramElement.parentElement].filter(
      (observedElement): observedElement is HTMLElement => observedElement !== null,
    );
    for (const observedElement of observedElements) layoutObserver.observe(observedElement);
    return () => layoutObserver.disconnect();
  }, [rawDiagramGeometry, diagramElementReference, layoutInput, diagramDirection]);
  return diagramGeometry;
}
