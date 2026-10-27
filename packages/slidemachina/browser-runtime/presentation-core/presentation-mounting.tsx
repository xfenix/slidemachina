import { StrictMode, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { connectCanvasToList } from "../slide-transitions/presentation-list-transition.ts";
import { PresentationListAddressContext } from "../presentation-interface/presentation-toolbar.tsx";

let presentationRoot: Root | undefined;

// One root keeps the slide and step across edits; a synchronous first render gives the list transition its canvas.
// A hot update renders synchronously too: the editor takes an edit as done once the new module runs, and finds the slides it moved in the DOM.
export function mountPresentation(presentationElement: ReactNode, presentationListAddress?: string) {
  const presentationTree = (
    <StrictMode>
      <PresentationListAddressContext value={presentationListAddress}>{presentationElement}</PresentationListAddressContext>
    </StrictMode>
  );
  if (presentationRoot !== undefined) {
    flushSync(() => presentationRoot!.render(presentationTree));
    return;
  }
  presentationRoot = createRoot(document.getElementById("slidemachina")!);
  if (presentationListAddress !== undefined) connectCanvasToList(presentationListAddress);
  flushSync(() => presentationRoot!.render(presentationTree));
}
