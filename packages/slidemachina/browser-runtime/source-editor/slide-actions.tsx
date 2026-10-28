import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";
import type { EditorTexts, SourceEditProblemCode } from "./editor-texts.ts";
import type { SlideAction, SourceEditAnswer, SourceEditRequest } from "./source-edit-requests.ts";

type SlideActionsProperties = {
  editorTexts: EditorTexts;
  runSourceEdit: (editRequest: SourceEditRequest) => Promise<SourceEditAnswer | undefined>;
  showProblem: (problemCode: SourceEditProblemCode) => void;
};

const slideSelector = "[data-canvas] > [data-slide]";

// A new slide takes the place of the one after the shown slide: going there before the hot update lands on it after.
export function goToNextSlidePlace() {
  const slideElements = [...document.querySelectorAll<HTMLElement>(slideSelector)];
  const nextSlideAddress = slideElements[slideElements.findIndex((slideElement) => slideElement.hasAttribute("data-current")) + 1]?.dataset.slideAddress;
  if (nextSlideAddress !== undefined) window.location.assign(`#${nextSlideAddress}`);
}

// Buttons of the editor in the toolbar: the shown slide gets a neighbour, a copy, a new place or goes away; the page follows it.
export function SlideActions({ editorTexts, runSourceEdit, showProblem }: SlideActionsProperties) {
  const changeShownSlide = async (slideAction: SlideAction) => {
    const sourceLocation = document.querySelector<HTMLElement>(`${slideSelector}[data-current]`)?.dataset.sourceLocation;
    // The slide of a section is drawn by the engine: it has no place in the file.
    if (sourceLocation === undefined) {
      showProblem("slidePlaceUnknown");
      return;
    }
    const editAnswer = await runSourceEdit({ editKind: "slide", sourceLocation, slideAction });
    if (editAnswer === undefined) return;
    if (slideAction === "add" || slideAction === "duplicate") goToNextSlidePlace();
    if (editAnswer.slideLocation === undefined) return;
    // A slide that stepped over a whole section moves by more than one number: the page finds it by its new place.
    const slideElements = [...document.querySelectorAll<HTMLElement>(slideSelector)];
    const movedSlideAddress = slideElements.find((slideElement) => slideElement.dataset.sourceLocation === editAnswer.slideLocation)?.dataset.slideAddress;
    if (movedSlideAddress !== undefined) window.location.assign(`#${movedSlideAddress}`);
  };
  return (
    <>
      <ToolbarButton label={editorTexts.addSlideButton} onPress={() => void changeShownSlide("add")}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="11" rx="2" />
          <path d="M10 7.5v5M7.5 10h5" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label={editorTexts.duplicateSlideButton} onPress={() => void changeShownSlide("duplicate")}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="6" y="6" width="11" height="9" rx="2" />
          <path d="M3.5 12V5.5a2 2 0 0 1 2-2H13" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label={editorTexts.earlierSlideButton} onPress={() => void changeShownSlide("earlier")}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12 5.5L7.5 10l4.5 4.5" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label={editorTexts.laterSlideButton} onPress={() => void changeShownSlide("later")}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 5.5l4.5 4.5L8 14.5" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label={editorTexts.removeSlideButton} onPress={() => void changeShownSlide("remove")}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
        </svg>
      </ToolbarButton>
      <span data-toolbar-divider />
    </>
  );
}
