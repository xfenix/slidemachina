import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { beginBoxDrag, type BoxDragGuides } from "./box-dragging.ts";
import { findLiveTarget, followOutlines, isAgentationPicking, type InteractionState, type ShownOutline } from "./editor-outlines.ts";
import { isSourceEditProblemCode, pickEditorTexts } from "./editor-texts.ts";
import { choosePictureFile, replacePicture } from "./picture-replacement.ts";
import { readSourceFile, sendSourceEdit, SourceEditFailure, type SourceEditRequest } from "./source-edit-requests.ts";
import { SlideActions } from "./slide-actions.tsx";
import { beginTextEditing } from "./text-editing.ts";

const dragThreshold = 4;
const statusDurations = { hint: 5000, saving: Infinity, saved: 2400, problem: 7000 };

type EditorStatus = { statusTone: "hint" | "saving" | "saved" | "problem"; statusText: string };

// The editor of slidemachina dev: texts, pictures and diagram boxes change on the slide and are written to the source.
export default function SourceEditor({ languageCode }: { languageCode: string }) {
  const editorTexts = pickEditorTexts(languageCode);
  const interactionReference = useRef<InteractionState>({ isFileOver: false });
  const [shownOutlines, setShownOutlines] = useState<ShownOutline[]>([]);
  const [dragGuides, setDragGuides] = useState<BoxDragGuides>();
  const [editorStatus, setEditorStatus] = useState<EditorStatus | undefined>({ statusTone: "hint", statusText: editorTexts.editorHint });

  useEffect(() => {
    if (editorStatus === undefined || !Number.isFinite(statusDurations[editorStatus.statusTone])) return;
    const dismissalTimer = setTimeout(() => setEditorStatus(undefined), statusDurations[editorStatus.statusTone]);
    return () => clearTimeout(dismissalTimer);
  }, [editorStatus]);

  // Resolves to the answer of the server, or undefined when the edit failed and the status shows why.
  const runSourceEdit = async (editRequest: SourceEditRequest) => {
    setEditorStatus({ statusTone: "saving", statusText: editorTexts.savingStatus });
    try {
      const editAnswer = await sendSourceEdit(editRequest);
      setEditorStatus({ statusTone: "saved", statusText: editorTexts.savedStatus(readSourceFile(editRequest.sourceLocation)) });
      return editAnswer;
    } catch (editFailure) {
      const problemCode = editFailure instanceof SourceEditFailure ? editFailure.problemCode : "writeFailed";
      setEditorStatus({ statusTone: "problem", statusText: editorTexts.problems[isSourceEditProblemCode(editorTexts, problemCode) ? problemCode : "writeFailed"] });
      return undefined;
    }
  };
  const runPageEdit = useEffectEvent(async (editRequest: SourceEditRequest) => (await runSourceEdit(editRequest)) !== undefined);

  useEffect(() => {
    const interactionState = interactionReference.current;
    const runSourceEdit = runPageEdit;

    const startTyping = (textElement: HTMLElement) => {
      interactionState.activeElement = textElement;
      const { finishTyping } = beginTextEditing(textElement, {
        saveText: (typedText) => runSourceEdit({ editKind: "text", sourceLocation: textElement.dataset.sourceLocation!, typedText }),
        finishEditing: () => {
          if (interactionState.activeElement !== textElement) return;
          interactionState.activeElement = undefined;
          interactionState.finishTyping = undefined;
        },
      });
      interactionState.finishTyping = finishTyping;
    };

    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (pointerEvent.button !== 0 || isAgentationPicking()) return;
      const targetElement = findLiveTarget(pointerEvent.target);
      if (targetElement === undefined || targetElement === interactionState.activeElement) return;
      const editKind = targetElement.dataset.sourceEdit;
      // The caret lands where the text was pressed: the element becomes editable before the browser handles the press.
      if (editKind === "text") {
        startTyping(targetElement);
        return;
      }
      // Without the default the press neither selects text nor takes focus, so a text being typed is finished here.
      pointerEvent.preventDefault();
      interactionState.finishTyping?.(true);
      if (editKind === "box") interactionState.pressedBox = { boxElement: targetElement, pressX: pointerEvent.clientX, pressY: pointerEvent.clientY };
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const { pressedBox } = interactionState;
      if (pressedBox !== undefined && interactionState.activeBoxDrag === undefined) {
        const pressDistance = Math.hypot(pointerEvent.clientX - pressedBox.pressX, pointerEvent.clientY - pressedBox.pressY);
        if (pressDistance >= dragThreshold) {
          interactionState.activeBoxDrag = beginBoxDrag(pressedBox.boxElement, pressedBox.pressX, pressedBox.pressY);
          interactionState.activeElement = pressedBox.boxElement;
        }
      }
      if (interactionState.activeBoxDrag !== undefined) {
        interactionState.dragGuides = interactionState.activeBoxDrag.movePointerTo(pointerEvent.clientX, pointerEvent.clientY);
        setDragGuides(interactionState.dragGuides);
        return;
      }
      interactionState.hoveredElement = isAgentationPicking() ? undefined : findLiveTarget(pointerEvent.target);
    };

    const handlePointerUp = () => {
      const { activeBoxDrag, pressedBox } = interactionState;
      interactionState.pressedBox = undefined;
      if (activeBoxDrag === undefined || pressedBox === undefined) return;
      interactionState.activeBoxDrag = undefined;
      interactionState.dragGuides = undefined;
      interactionState.activeElement = undefined;
      setDragGuides(undefined);
      const dropPlan = activeBoxDrag.finishDrag();
      if (dropPlan === undefined) {
        activeBoxDrag.releaseBox();
        return;
      }
      interactionState.heldBoxDrag = activeBoxDrag;
      activeBoxDrag.holdUntilLaidOut(runSourceEdit({ editKind: "box", sourceLocation: pressedBox.boxElement.dataset.sourceLocation!, ...dropPlan }));
    };

    const handleClick = (clickEvent: MouseEvent) => {
      const pictureElement = findLiveTarget(clickEvent.target, "picture");
      if (pictureElement === undefined || isAgentationPicking()) return;
      clickEvent.preventDefault();
      choosePictureFile((pictureFile) => void replacePicture(pictureElement, pictureFile, runSourceEdit));
    };

    // Any file dropped on the page is caught: otherwise the browser would leave the presentation to open it.
    const handleDragOver = (dragEvent: DragEvent) => {
      if (!dragEvent.dataTransfer?.types.includes("Files")) return;
      dragEvent.preventDefault();
      interactionState.isFileOver = true;
      interactionState.dropElement = findLiveTarget(dragEvent.target, "picture");
      dragEvent.dataTransfer.dropEffect = interactionState.dropElement === undefined ? "none" : "copy";
    };
    const handleDragLeave = (dragEvent: DragEvent) => {
      if (dragEvent.relatedTarget === null) interactionState.isFileOver = false;
    };
    const handleDrop = (dragEvent: DragEvent) => {
      if (!dragEvent.dataTransfer?.types.includes("Files")) return;
      dragEvent.preventDefault();
      interactionState.isFileOver = false;
      const pictureElement = findLiveTarget(dragEvent.target, "picture");
      const pictureFile = dragEvent.dataTransfer.files[0];
      if (pictureElement === undefined || pictureFile === undefined) {
        setEditorStatus({ statusTone: "problem", statusText: editorTexts.dropOutsidePicture });
        return;
      }
      void replacePicture(pictureElement, pictureFile, runSourceEdit);
    };

    const pageListeners = [
      ["pointerdown", handlePointerDown, true],
      ["pointermove", handlePointerMove, false],
      ["pointerup", handlePointerUp, false],
      ["pointercancel", handlePointerUp, false],
      ["click", handleClick, true],
      ["dragover", handleDragOver, false],
      ["dragleave", handleDragLeave, false],
      ["drop", handleDrop, false],
    ] as const;
    for (const [eventName, eventHandler, usesCapture] of pageListeners) document.addEventListener(eventName, eventHandler as EventListener, usesCapture);

    const stopFollowingOutlines = followOutlines(interactionState, editorTexts, setShownOutlines);
    document.documentElement.setAttribute("data-source-editor", "");

    return () => {
      for (const [eventName, eventHandler, usesCapture] of pageListeners) document.removeEventListener(eventName, eventHandler as EventListener, usesCapture);
      stopFollowingOutlines();
      document.documentElement.removeAttribute("data-source-editor");
      interactionState.finishTyping?.(true);
      interactionState.activeBoxDrag?.releaseBox();
      interactionState.heldBoxDrag?.releaseBox();
      Object.assign(interactionState, { hoveredElement: undefined, activeElement: undefined, activeBoxDrag: undefined, heldBoxDrag: undefined, pressedBox: undefined, isFileOver: false });
    };
  }, [editorTexts]);

  return (
    <>
      <SlideActions
        editorTexts={editorTexts}
        runSourceEdit={runSourceEdit}
        showProblem={(problemCode) => setEditorStatus({ statusTone: "problem", statusText: editorTexts.problems[problemCode] })}
      />
      {editorStatus !== undefined && (
        <output data-editor-status={editorStatus.statusTone} aria-live="polite" key={editorStatus.statusText}>
          <span data-editor-status-mark aria-hidden="true" />
          {editorStatus.statusText}
        </output>
      )}
      {createPortal(
        <div data-editor-overlay>
          {dragGuides !== undefined && (
            <>
              <div data-editor-column-band style={dragGuides.columnBand} />
              {dragGuides.insertionLine !== undefined && <div data-editor-insertion-line style={dragGuides.insertionLine} />}
            </>
          )}
          {shownOutlines.map((shownOutline, outlinePosition) => (
            <div
              key={outlinePosition}
              data-editor-outline={shownOutline.outlineState}
              data-editor-outline-kind={shownOutline.editKind}
              style={shownOutline.outlineFrame}
            >
              {shownOutline.chipTitle !== undefined && (
                <span data-editor-chip>
                  {shownOutline.chipTitle}
                  {shownOutline.chipNote !== undefined && <span data-editor-chip-note>{shownOutline.chipNote}</span>}
                </span>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
