import type { BoxDrag, BoxDragGuides, ScreenFrame } from "./box-dragging.ts";
import type { EditorTexts } from "./editor-texts.ts";

type OutlineState = "hover" | "active" | "droppable" | "drop";
export type ShownOutline = { outlineFrame: ScreenFrame; editKind: string; outlineState: OutlineState; chipTitle?: string; chipNote?: string };

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

export function findLiveTarget(eventTarget: EventTarget | null, wantedKind?: string): HTMLElement | undefined {
  if (!(eventTarget instanceof Element)) return undefined;
  // Text inside a diagram box (its <small> line) belongs to the box: the box is dragged, not typed into.
  const targetElement = eventTarget.closest<HTMLElement>('[data-source-edit="box"]') ?? eventTarget.closest<HTMLElement>("[data-source-edit]");
  const slideElement = targetElement?.closest("[data-slide]");
  const isLiveSlide = slideElement?.hasAttribute("data-current") && slideElement.parentElement?.hasAttribute("data-canvas");
  if (!isLiveSlide || (wantedKind !== undefined && targetElement!.dataset.sourceEdit !== wantedKind)) return undefined;
  return targetElement!;
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
  const kindTitles: Record<string, string> = { text: editorTexts.textKind, picture: editorTexts.pictureKind, box: editorTexts.boxKind };
  const describeOutline = (targetElement: HTMLElement, outlineState: OutlineState): ShownOutline => {
    const editKind = targetElement.dataset.sourceEdit!;
    const sourceLocation = (targetElement.dataset.sourceLocation ?? "").replace(/:\d+$/, "");
    const shownOutline: ShownOutline = { outlineFrame: measureEditableFrame(targetElement), editKind, outlineState, chipTitle: kindTitles[editKind], chipNote: sourceLocation };
    if (outlineState === "drop") return { ...shownOutline, chipTitle: editorTexts.pictureDropHint, chipNote: undefined };
    if (outlineState === "droppable") return { ...shownOutline, chipTitle: undefined };
    if (editKind === "picture") return { ...shownOutline, chipNote: editorTexts.pictureHint };
    if (outlineState === "active" && editKind === "text") return { ...shownOutline, chipNote: editorTexts.textEditingHint };
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
