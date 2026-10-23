import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import {
  Arrow,
  Box,
  Focus,
  Group,
  type ArrowProperties,
  type BoxProperties,
  type FocusProperties,
  type GroupProperties,
} from "./diagram-parts.tsx";

type BoxPart = { partKind: "box"; nodeIdentifier: string; boxProperties: BoxProperties };
type GroupPart = { partKind: "group"; nodeIdentifier: string; groupProperties: GroupProperties; innerParts: DiagramPart[] };
export type ArrowPart = { partKind: "arrow"; arrowIdentifier: string; arrowProperties: ArrowProperties };
type FocusPart = { partKind: "focus"; focusProperties: FocusProperties };
export type DiagramPart = BoxPart | GroupPart | ArrowPart | FocusPart;
export type NodePart = BoxPart | GroupPart;

// Fragments are see-through, so parts can come from a helper that returns <>…</>.
export function listMarkupElements(markupChildren: ReactNode): ReactElement[] {
  return Children.toArray(markupChildren)
    .filter(isValidElement)
    .flatMap((markupElement) =>
      markupElement.type === Fragment
        ? listMarkupElements((markupElement.props as { children?: ReactNode }).children)
        : [markupElement],
    );
}

// Internal names carry a colon, so they never meet an id written by the author.
export function outlineDiagramParts(diagramChildren: ReactNode, parentPath = "root"): DiagramPart[] {
  return listMarkupElements(diagramChildren).flatMap((markupElement, elementPosition): DiagramPart[] => {
    const elementPath = `${parentPath}:${elementPosition}`;
    if (markupElement.type === Box) {
      const boxProperties = markupElement.props as BoxProperties;
      return [{ partKind: "box", nodeIdentifier: boxProperties.id, boxProperties }];
    }
    if (markupElement.type === Group) {
      const groupProperties = markupElement.props as GroupProperties;
      const innerParts = outlineDiagramParts(groupProperties.children, elementPath);
      return [{ partKind: "group", nodeIdentifier: groupProperties.id ?? `group:${elementPath}`, groupProperties, innerParts }];
    }
    if (markupElement.type === Arrow) {
      return [{ partKind: "arrow", arrowIdentifier: `arrow:${elementPath}`, arrowProperties: markupElement.props as ArrowProperties }];
    }
    if (markupElement.type === Focus) return [{ partKind: "focus", focusProperties: markupElement.props as FocusProperties }];
    return [];
  });
}

export function listNodeParts(diagramParts: DiagramPart[]): NodePart[] {
  return diagramParts.filter((diagramPart): diagramPart is NodePart => diagramPart.partKind === "box" || diagramPart.partKind === "group");
}

export function listArrowParts(diagramParts: DiagramPart[]): ArrowPart[] {
  return diagramParts.flatMap((diagramPart) => {
    if (diagramPart.partKind === "arrow") return [diagramPart];
    return diagramPart.partKind === "group" ? listArrowParts(diagramPart.innerParts) : [];
  });
}

// Every node mapped to the chain of groups around it, outermost first.
export function mapEnclosingGroups(diagramParts: DiagramPart[], enclosingGroups: string[] = [], groupChains = new Map<string, string[]>()) {
  for (const nodePart of listNodeParts(diagramParts)) {
    groupChains.set(nodePart.nodeIdentifier, enclosingGroups);
    if (nodePart.partKind === "group") {
      mapEnclosingGroups(nodePart.innerParts, [...enclosingGroups, nodePart.nodeIdentifier], groupChains);
    }
  }
  return groupChains;
}
