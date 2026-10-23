export type ScreenFrame = { left: number; top: number; width: number; height: number };

export type BoxDragGuides = {
  columnBand: ScreenFrame;
  insertionLine?: ScreenFrame;
  columnNumber: number;
  placeNumber: number;
};

type BoxDropPlan = {
  columnNumber?: number;
  anchorLocation?: string;
  anchorSide?: "before" | "after";
};

// Flow runs along the arrows: x for a diagram to the right, y for one going down. Cross is the other axis.
type AxisFrame = { flowStart: number; flowEnd: number; crossStart: number; crossEnd: number };
type LevelNode = { nodeElement: HTMLElement; flowColumn: number; axisFrame: AxisFrame };
type ColumnSlot = { columnNumber: number; flowStart: number; flowEnd: number; members: LevelNode[] };

const crossCenter = (axisFrame: AxisFrame) => (axisFrame.crossStart + axisFrame.crossEnd) / 2;
const flowCenter = (axisFrame: { flowStart: number; flowEnd: number }) => (axisFrame.flowStart + axisFrame.flowEnd) / 2;

function readAxisFrame(nodeElement: HTMLElement, flowsRight: boolean): AxisFrame {
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = nodeElement;
  return flowsRight
    ? { flowStart: offsetLeft, flowEnd: offsetLeft + offsetWidth, crossStart: offsetTop, crossEnd: offsetTop + offsetHeight }
    : { flowStart: offsetTop, flowEnd: offsetTop + offsetHeight, crossStart: offsetLeft, crossEnd: offsetLeft + offsetWidth };
}

// Columns of the box's own level: the diagram itself or the group around the box. One more empty column waits on the far side.
function collectColumnSlots(levelNodes: LevelNode[], draggedNode: LevelNode): ColumnSlot[] {
  const columnSlots = new Map<number, ColumnSlot>();
  for (const levelNode of levelNodes) {
    const columnSlot = columnSlots.get(levelNode.flowColumn) ?? { columnNumber: levelNode.flowColumn, flowStart: Infinity, flowEnd: -Infinity, members: [] };
    columnSlot.flowStart = Math.min(columnSlot.flowStart, levelNode.axisFrame.flowStart);
    columnSlot.flowEnd = Math.max(columnSlot.flowEnd, levelNode.axisFrame.flowEnd);
    if (levelNode !== draggedNode) columnSlot.members.push(levelNode);
    columnSlots.set(levelNode.flowColumn, columnSlot);
  }
  const sortedSlots = [...columnSlots.values()].sort((firstSlot, secondSlot) => firstSlot.columnNumber - secondSlot.columnNumber);
  for (const columnSlot of sortedSlots) columnSlot.members.sort((firstNode, secondNode) => firstNode.axisFrame.crossStart - secondNode.axisFrame.crossStart);
  const lastSlot = sortedSlots.at(-1)!;
  const draggedFlowSize = draggedNode.axisFrame.flowEnd - draggedNode.axisFrame.flowStart;
  const columnGap = sortedSlots.length > 1 ? sortedSlots[1].flowStart - sortedSlots[0].flowEnd : draggedFlowSize / 2;
  const newSlotStart = lastSlot.flowEnd + columnGap;
  sortedSlots.push({ columnNumber: lastSlot.columnNumber + 1, flowStart: newSlotStart, flowEnd: newSlotStart + draggedFlowSize, members: [] });
  return sortedSlots;
}

function findInsertionCross(columnMembers: LevelNode[], insertionIndex: number): number | undefined {
  if (columnMembers.length === 0) return undefined;
  const memberGap = columnMembers.length > 1 ? columnMembers[1].axisFrame.crossStart - columnMembers[0].axisFrame.crossEnd : 24;
  if (insertionIndex === 0) return columnMembers[0].axisFrame.crossStart - memberGap / 2;
  if (insertionIndex === columnMembers.length) return columnMembers.at(-1)!.axisFrame.crossEnd + memberGap / 2;
  return (columnMembers[insertionIndex - 1].axisFrame.crossEnd + columnMembers[insertionIndex].axisFrame.crossStart) / 2;
}

// The box snaps to the nearest column and slides freely across it; a line shows where it lands among the other boxes.
export function beginBoxDrag(boxElement: HTMLElement, startX: number, startY: number) {
  const diagramElement = boxElement.closest<HTMLElement>("[data-diagram]")!;
  const flowsRight = diagramElement.dataset.direction !== "down";
  const levelElements = [...boxElement.parentElement!.children].filter(
    (siblingElement): siblingElement is HTMLElement => siblingElement instanceof HTMLElement && siblingElement.matches("[data-box], [data-group]"),
  );
  const levelNodes = levelElements.map((nodeElement) => ({
    nodeElement,
    flowColumn: Number(nodeElement.dataset.flowColumn),
    axisFrame: readAxisFrame(nodeElement, flowsRight),
  }));
  const draggedNode = levelNodes.find((levelNode) => levelNode.nodeElement === boxElement)!;
  const columnSlots = collectColumnSlots(levelNodes, draggedNode);
  const startSlot = columnSlots.find((columnSlot) => columnSlot.columnNumber === draggedNode.flowColumn)!;
  const startIndex = startSlot.members.filter((memberNode) => crossCenter(memberNode.axisFrame) < crossCenter(draggedNode.axisFrame)).length;
  const levelCrossStart = Math.min(...levelNodes.map((levelNode) => levelNode.axisFrame.crossStart));
  const levelCrossEnd = Math.max(...levelNodes.map((levelNode) => levelNode.axisFrame.crossEnd));
  const startFrame = boxElement.getBoundingClientRect();
  const localScale = startFrame.width / boxElement.offsetWidth;
  const levelOrigin = { x: startFrame.left - boxElement.offsetLeft * localScale, y: startFrame.top - boxElement.offsetTop * localScale };
  const draggedFrame = draggedNode.axisFrame;
  const draggedFlowSize = draggedFrame.flowEnd - draggedFrame.flowStart;
  const draggedCrossSize = draggedFrame.crossEnd - draggedFrame.crossStart;

  const toScreen = (flowStart: number, flowEnd: number, crossStart: number, crossEnd: number): ScreenFrame => {
    const [localLeft, localTop, localWidth, localHeight] = flowsRight
      ? [flowStart, crossStart, flowEnd - flowStart, crossEnd - crossStart]
      : [crossStart, flowStart, crossEnd - crossStart, flowEnd - flowStart];
    return { left: levelOrigin.x + localLeft * localScale, top: levelOrigin.y + localTop * localScale, width: localWidth * localScale, height: localHeight * localScale };
  };
  const shiftBox = (flowStart: number, crossStart: number) => {
    const flowShift = flowStart - draggedFrame.flowStart;
    const crossShift = crossStart - draggedFrame.crossStart;
    return flowsRight ? { shiftX: flowShift, shiftY: crossShift } : { shiftX: crossShift, shiftY: flowShift };
  };

  let chosenSlot = startSlot;
  let chosenIndex = startIndex;
  const laidOutPlace = { left: boxElement.offsetLeft, top: boxElement.offsetTop };
  let heldPlace = laidOutPlace;
  boxElement.setAttribute("data-source-dragging", "");

  const movePointerTo = (pointerX: number, pointerY: number): BoxDragGuides => {
    const [screenFlowShift, screenCrossShift] = flowsRight ? [pointerX - startX, pointerY - startY] : [pointerY - startY, pointerX - startX];
    const draggedFlowCenter = flowCenter(draggedFrame) + screenFlowShift / localScale;
    const draggedCrossCenter = crossCenter(draggedFrame) + screenCrossShift / localScale;
    chosenSlot = columnSlots.reduce((nearestSlot, columnSlot) =>
      Math.abs(flowCenter(columnSlot) - draggedFlowCenter) < Math.abs(flowCenter(nearestSlot) - draggedFlowCenter) ? columnSlot : nearestSlot,
    );
    chosenIndex = chosenSlot.members.filter((memberNode) => crossCenter(memberNode.axisFrame) < draggedCrossCenter).length;
    const insertionCross = findInsertionCross(chosenSlot.members, chosenIndex);
    const snappedFlowStart = flowCenter(chosenSlot) - draggedFlowSize / 2;
    const followingShift = shiftBox(snappedFlowStart, draggedCrossCenter - draggedCrossSize / 2);
    boxElement.style.transform = `translate(${followingShift.shiftX}px, ${followingShift.shiftY}px)`;
    // Until the new layout arrives the box takes the place of the box it lands before, or goes under the last one.
    const columnMembers = chosenSlot.members;
    const landingCrossStart =
      insertionCross === undefined
        ? draggedCrossCenter - draggedCrossSize / 2
        : chosenIndex < columnMembers.length
          ? columnMembers[chosenIndex].axisFrame.crossStart
          : 2 * insertionCross - columnMembers.at(-1)!.axisFrame.crossEnd;
    const landingShift = shiftBox(snappedFlowStart, landingCrossStart);
    heldPlace = { left: laidOutPlace.left + landingShift.shiftX, top: laidOutPlace.top + landingShift.shiftY };
    const bandPadding = 12;
    return {
      columnBand: toScreen(chosenSlot.flowStart - bandPadding, chosenSlot.flowEnd + bandPadding, levelCrossStart - bandPadding, levelCrossEnd + bandPadding),
      insertionLine: insertionCross === undefined ? undefined : toScreen(chosenSlot.flowStart, chosenSlot.flowEnd, insertionCross - 1 / localScale, insertionCross + 1 / localScale),
      columnNumber: chosenSlot.columnNumber,
      placeNumber: chosenIndex + 1,
    };
  };

  // The anchor is the box the dragged one now stands before, or after when it goes last in the column.
  const finishDrag = (): BoxDropPlan | undefined => {
    boxElement.removeAttribute("data-source-dragging");
    const changesColumn = chosenSlot.columnNumber !== draggedNode.flowColumn;
    if (!changesColumn && chosenIndex === startIndex) return undefined;
    const columnMembers = chosenSlot.members;
    const anchorNode = columnMembers[chosenIndex] ?? columnMembers.at(-1);
    return {
      columnNumber: changesColumn ? chosenSlot.columnNumber : undefined,
      anchorLocation: anchorNode?.nodeElement.dataset.sourceLocation,
      anchorSide: chosenIndex < columnMembers.length ? "before" : "after",
    };
  };

  const nodeIdentifier = boxElement.dataset.nodeId!;
  let isReleased = false;

  const releaseBox = () => {
    isReleased = true;
    boxElement.removeAttribute("data-source-dragging");
    for (const draggedElement of diagramElement.querySelectorAll<HTMLElement>("[data-box]")) draggedElement.style.transform = "";
  };

  // The dropped box waits for the new layout and is found by id each frame: React may reuse its element.
  const holdUntilLaidOut = (sourceUpdate: Promise<boolean>) => {
    let updateTime: number | undefined;
    void sourceUpdate.then((isEditSaved) => {
      if (isEditSaved) updateTime = performance.now();
      else releaseBox();
    });
    const keepInPlace = () => {
      if (isReleased) return;
      const currentElement = diagramElement.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeIdentifier)}"]`);
      const isLaidOut = currentElement !== null && (currentElement.offsetLeft !== laidOutPlace.left || currentElement.offsetTop !== laidOutPlace.top);
      const waitsTooLong = updateTime !== undefined && performance.now() - updateTime > 1500;
      if (currentElement === null || isLaidOut || waitsTooLong) {
        releaseBox();
        return;
      }
      for (const otherElement of diagramElement.querySelectorAll<HTMLElement>("[data-box]")) {
        if (otherElement !== currentElement) otherElement.style.transform = "";
      }
      currentElement.style.transform = `translate(${heldPlace.left - currentElement.offsetLeft}px, ${heldPlace.top - currentElement.offsetTop}px)`;
      requestAnimationFrame(keepInPlace);
    };
    keepInPlace();
  };

  return { movePointerTo, finishDrag, releaseBox, holdUntilLaidOut };
}

export type BoxDrag = ReturnType<typeof beginBoxDrag>;
