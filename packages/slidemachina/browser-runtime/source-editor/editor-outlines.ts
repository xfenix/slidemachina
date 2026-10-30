import type { BoxDrag, BoxDragGuides, ScreenFrame } from "./box-dragging.ts";
import type { EditorTexts } from "./editor-texts.ts";

type OutlineState = "hover" | "active" | "droppable" | "drop";
export type ShownOutline = {
  outlineFrame: ScreenFrame;
  editKind: string;
  outlineState: OutlineState;
  chipTitle?: string;
  chipNote?: string;
  // The enclosing list item: the outline carries the buttons that add, move and remove it.
  listItemLocation?: string;
};

// What the editor is doing right now; read every frame, so it lives outside React state.
export type InteractionState = {
  hoveredElement?: HTMLElement;
  activeElement?: HTMLElement;
  pressedBox?: { boxElement: HTMLElement; pressX: number; pressY: number };
  activeBoxDrag?: BoxDrag;
  // A dropped box waiting for its new layout: switching the editor off lets it go.
  heldBoxDrag?: BoxDrag;
  dragGuides?: BoxDragGuides;
  isFileOver: boolean;
  dropElement?: HTMLElement;
  finishTyping?: (keepsText: boolean) => void;
};

export function findLiveTarget(pointerEvent: PointerEvent | MouseEvent | DragEvent, wantedKind?: string): HTMLElement | undefined {
  // A press on the editor's own buttons stays there: the stacked hit-test must not fall through to the slide beneath.
  if (pointerEvent.target instanceof Element && pointerEvent.target.closest("[data-editor-overlay]") !== null) return undefined;
  // Text inside a diagram box (its <small> line) belongs to the box: the box is dragged, not typed into.
  // A list item with mixed content has no edit of its own: the item itself is the target carrying the buttons.
  const targetElement =
    pointerEvent.target instanceof Element
      ? (pointerEvent.target.closest<HTMLElement>('[data-source-edit="box"]') ??
        pointerEvent.target.closest<HTMLElement>("[data-source-edit]") ??
        pointerEvent.target.closest<HTMLElement>("li[data-source-location]"))
      : undefined;
  const liveTarget = pickLiveTarget(targetElement ?? undefined, wantedKind);
  if (liveTarget !== undefined) return liveTarget;
  // A full media sits behind the content layer and never gets the click: hit-test through the covering elements.
  const stackedElement = document
    .elementsFromPoint(pointerEvent.clientX, pointerEvent.clientY)
    .find((element) => element.matches("[data-source-edit], li[data-source-location]"));
  return pickLiveTarget(stackedElement as HTMLElement | undefined, wantedKind);
}

function pickLiveTarget(targetElement: HTMLElement | undefined, wantedKind?: string): HTMLElement | undefined {
  const slideElement = targetElement?.closest("[data-slide]");
  const isLiveSlide = slideElement?.hasAttribute("data-current") && slideElement.parentElement?.hasAttribute("data-canvas");
  if (!isLiveSlide || (wantedKind !== undefined && targetElement!.dataset.sourceEdit !== wantedKind)) return undefined;
  return targetElement;
}

// Agentation's picking mode puts its own cursor style on the page; the editor steps aside meanwhile.
export function isAgentationPicking() {
  return document.getElementById("agentation-cursor") !== null;
}

// Text is outlined around its letters, not the whole width of its block.
function measureEditableFrame(targetElement: HTMLElement): ScreenFrame {
  let elementFrame: DOMRect = targetElement.getBoundingClientRect();
  if (targetElement.dataset.sourceEdit === "text") {
    const textRange = document.createRange();
    textRange.selectNodeContents(targetElement);
    elementFrame = textRange.getBoundingClientRect();
  }
  return { left: elementFrame.left, top: elementFrame.top, width: elementFrame.width, height: elementFrame.height };
}

function describeOutlines(interactionState: InteractionState, editorTexts: EditorTexts): ShownOutline[] {
  const kindTitles: Record<string, string> = { text: editorTexts.textKind, picture: editorTexts.pictureKind, box: editorTexts.boxKind, attribute: editorTexts.attributeKind };
  const describeOutline = (targetElement: HTMLElement, outlineState: OutlineState): ShownOutline => {
    const editKind = targetElement.dataset.sourceEdit!;
    const sourceLocation = (targetElement.dataset.sourceLocation ?? "").replace(/:\d+$/, "");
    const shownOutline: ShownOutline = { outlineFrame: measureEditableFrame(targetElement), editKind, outlineState, chipTitle: kindTitles[editKind], chipNote: sourceLocation };
    if (outlineState === "drop") return { ...shownOutline, chipTitle: editorTexts.pictureDropHint, chipNote: undefined };
    if (outlineState === "droppable") return { ...shownOutline, chipTitle: undefined };
    const listItemLocation = targetElement.closest("li")?.dataset.sourceLocation;
    if (listItemLocation !== undefined) return { ...shownOutline, listItemLocation };
    if (editKind === "picture") return { ...shownOutline, chipNote: editorTexts.pictureHint };
    if (outlineState === "active" && (editKind === "text" || editKind === "attribute")) return { ...shownOutline, chipNote: editorTexts.textEditingHint };
    const { dragGuides } = interactionState;
    if (outlineState === "active" && dragGuides !== undefined) {
      return { ...shownOutline, chipNote: editorTexts.boxPlaceHint(dragGuides.columnNumber, dragGuides.placeNumber) };
    }
    return shownOutline;
  };
  if (interactionState.isFileOver) {
    const slidePictures = document.querySelectorAll<HTMLElement>('[data-canvas] > [data-slide][data-current] [data-source-edit="picture"]');
    return [...slidePictures].map((pictureElement) => describeOutline(pictureElement, pictureElement === interactionState.dropElement ? "drop" : "droppable"));
  }
  const { hoveredElement, activeElement } = interactionState;
  const shownOutlines = activeElement === undefined ? [] : [describeOutline(activeElement, "active")];
  if (hoveredElement !== undefined && hoveredElement !== activeElement && hoveredElement.isConnected) {
    shownOutlines.push(describeOutline(hoveredElement, "hover"));
  }
  return shownOutlines;
}

// Outlines follow their elements every frame: steps, transitions and the hot update move them.
export function followOutlines(interactionState: InteractionState, editorTexts: EditorTexts, showOutlines: (shownOutlines: ShownOutline[]) => void) {
  let outlineFrameRequest = 0;
  let shownOutlinesKey = "";
  const trackOutlines = () => {
    const describedOutlines = describeOutlines(interactionState, editorTexts);
    const describedKey = JSON.stringify(describedOutlines);
    if (describedKey !== shownOutlinesKey) {
      shownOutlinesKey = describedKey;
      showOutlines(describedOutlines);
    }
    outlineFrameRequest = requestAnimationFrame(trackOutlines);
  };
  trackOutlines();
  return () => cancelAnimationFrame(outlineFrameRequest);
}
