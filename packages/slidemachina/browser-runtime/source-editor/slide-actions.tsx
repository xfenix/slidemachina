import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";
import { readPositionFromHash } from "../slide-navigation/position-hash.ts";
import type { EditorTexts, SourceEditProblemCode } from "./editor-texts.ts";
import type { SlideAction, SourceEditAnswer, SourceEditRequest } from "./source-edit-requests.ts";

type SlideActionsProperties = {
  editorTexts: EditorTexts;
  runSourceEdit: (editRequest: SourceEditRequest) => Promise<SourceEditAnswer | undefined>;
  showProblem: (problemCode: SourceEditProblemCode) => void;
};

// Buttons of the editor in the toolbar: the shown slide gets a neighbour, a copy, a new place or goes away; the page follows it.
export function SlideActions({ editorTexts, runSourceEdit, showProblem }: SlideActionsProperties) {
  const changeShownSlide = async (slideAction: SlideAction) => {
    const sourceLocation = document.querySelector<HTMLElement>("[data-canvas] > [data-slide][data-current]")?.dataset.sourceLocation;
    // The slide of a section is drawn by the engine: it has no place in the file.
    if (sourceLocation === undefined) {
      showProblem("slidePlaceUnknown");
      return;
    }
    const shownSlideNumber = readPositionFromHash().slideIndex + 1;
    const editAnswer = await runSourceEdit({ editKind: "slide", sourceLocation, slideAction });
    if (editAnswer === undefined) return;
    if (slideAction === "add" || slideAction === "duplicate") window.location.assign(`#${shownSlideNumber + 1}`);
    if (editAnswer.slideLocation === undefined) return;
    // A slide that stepped over a whole section moves by more than one number: the page finds it by its new place.
    const slideElements = [...document.querySelectorAll<HTMLElement>("[data-canvas] > [data-slide]")];
    const movedSlideIndex = slideElements.findIndex((slideElement) => slideElement.dataset.sourceLocation === editAnswer.slideLocation);
    if (movedSlideIndex !== -1) window.location.assign(`#${movedSlideIndex + 1}`);
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
