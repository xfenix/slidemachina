import { listNodeParts, type ArrowPart, type DiagramPart, type NodePart } from "./diagram-outline.ts";

type ProjectedArrow = { sourceIdentifier: string; targetIdentifier: string };

// An arrow between nested boxes counts at the level where their groups part: api → logs is server → logs at the top.
function projectArrows(levelChain: string[], allArrows: ProjectedArrow[], groupChains: Map<string, string[]>): ProjectedArrow[] {
  const levelDepth = levelChain.length;
  return allArrows.flatMap(({ sourceIdentifier, targetIdentifier }) => {
    const sourceChain = [...(groupChains.get(sourceIdentifier) ?? []), sourceIdentifier];
    const targetChain = [...(groupChains.get(targetIdentifier) ?? []), targetIdentifier];
    const sharesLevel = levelChain.every(
      (groupIdentifier, chainPosition) => sourceChain[chainPosition] === groupIdentifier && targetChain[chainPosition] === groupIdentifier,
    );
    const sourceSibling = sourceChain[levelDepth];
    const targetSibling = targetChain[levelDepth];
    if (!sharesLevel || sourceSibling === undefined || targetSibling === undefined || sourceSibling === targetSibling) return [];
    return [{ sourceIdentifier: sourceSibling, targetIdentifier: targetSibling }];
  });
}

// Arrows that close a loop point back; the rest decide the flow. Visited in markup order, so the first arrow wins.
function keepForwardArrows(siblingIdentifiers: string[], levelArrows: ProjectedArrow[]): ProjectedArrow[] {
  const forwardArrows: ProjectedArrow[] = [];
  const visitState = new Map<string, "open" | "done">();
  const visitSibling = (siblingIdentifier: string) => {
    visitState.set(siblingIdentifier, "open");
    for (const levelArrow of levelArrows) {
      if (levelArrow.sourceIdentifier !== siblingIdentifier) continue;
      const targetState = visitState.get(levelArrow.targetIdentifier);
      if (targetState === "open") continue;
      forwardArrows.push(levelArrow);
      if (targetState === undefined) visitSibling(levelArrow.targetIdentifier);
    }
    visitState.set(siblingIdentifier, "done");
  };
  for (const siblingIdentifier of siblingIdentifiers) if (!visitState.has(siblingIdentifier)) visitSibling(siblingIdentifier);
  return forwardArrows;
}

function readFixedColumn(nodePart: NodePart): number | undefined {
  if (nodePart.partKind !== "box") return undefined;
  const { column, first } = nodePart.boxProperties;
  if (first) return 0;
  return column === undefined ? undefined : Math.max(Math.round(column) - 1, 0);
}

// A block goes one column after the blocks pointing at it; column, first and last pin it.
function assignLevelColumns(siblingParts: NodePart[], levelArrows: ProjectedArrow[], columnNumbers: Map<string, number>) {
  const siblingIdentifiers = siblingParts.map((siblingPart) => siblingPart.nodeIdentifier);
  const forwardArrows = keepForwardArrows(siblingIdentifiers, levelArrows);
  const fixedColumns = new Map(siblingParts.flatMap((siblingPart) => {
    const fixedColumn = readFixedColumn(siblingPart);
    return fixedColumn === undefined ? [] : [[siblingPart.nodeIdentifier, fixedColumn] as const];
  }));
  const lastParts = siblingParts.filter((siblingPart) => siblingPart.partKind === "box" && siblingPart.boxProperties.last);
  const levelColumns = new Map(siblingIdentifiers.map((siblingIdentifier) => [siblingIdentifier, fixedColumns.get(siblingIdentifier) ?? 0]));
  for (let relaxationRound = 0; relaxationRound < siblingIdentifiers.length; relaxationRound += 1) {
    for (const { sourceIdentifier, targetIdentifier } of forwardArrows) {
      const sourceColumn = levelColumns.get(sourceIdentifier)!;
      const targetColumn = levelColumns.get(targetIdentifier)!;
      // ELK cannot draw an arrow inside one column and moves the target on its own; the shared box widths would then be wrong.
      const isPinnedBeside = fixedColumns.has(targetIdentifier) && targetColumn !== sourceColumn;
      if (!isPinnedBeside) levelColumns.set(targetIdentifier, Math.max(targetColumn, sourceColumn + 1));
    }
  }
  const pointedIdentifiers = new Set(forwardArrows.map((forwardArrow) => forwardArrow.targetIdentifier));
  for (const siblingIdentifier of siblingIdentifiers) {
    if (fixedColumns.has(siblingIdentifier) || pointedIdentifiers.has(siblingIdentifier)) continue;
    const targetColumns = forwardArrows
      .filter((forwardArrow) => forwardArrow.sourceIdentifier === siblingIdentifier)
      .map((forwardArrow) => levelColumns.get(forwardArrow.targetIdentifier)!);
    if (targetColumns.length > 0) levelColumns.set(siblingIdentifier, Math.max(Math.min(...targetColumns) - 1, 0));
  }
  const lastIdentifiers = new Set(lastParts.map((lastPart) => lastPart.nodeIdentifier));
  const lastColumn = Math.max(0, ...[...levelColumns].filter(([siblingIdentifier]) => !lastIdentifiers.has(siblingIdentifier)).map(([, levelColumn]) => levelColumn));
  for (const lastIdentifier of lastIdentifiers) levelColumns.set(lastIdentifier, Math.max(levelColumns.get(lastIdentifier)!, lastColumn));
  for (const [siblingIdentifier, levelColumn] of levelColumns) columnNumbers.set(siblingIdentifier, levelColumn);
}

// Columns count inside their own level: blocks of a group line up within the group's frame.
export function assignDiagramColumns(diagramParts: DiagramPart[], drawnArrows: ArrowPart[], groupChains: Map<string, string[]>): Map<string, number> {
  const allArrows = drawnArrows.map(({ arrowProperties }) => ({ sourceIdentifier: arrowProperties.from, targetIdentifier: arrowProperties.to }));
  const columnNumbers = new Map<string, number>();
  const assignLevel = (siblingParts: NodePart[], levelChain: string[]) => {
    assignLevelColumns(siblingParts, projectArrows(levelChain, allArrows, groupChains), columnNumbers);
    for (const siblingPart of siblingParts) {
      if (siblingPart.partKind === "group") assignLevel(listNodeParts(siblingPart.innerParts), [...levelChain, siblingPart.nodeIdentifier]);
    }
  };
  assignLevel(listNodeParts(diagramParts), []);
  return columnNumbers;
}
