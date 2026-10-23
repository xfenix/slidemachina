import { StrictMode, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { connectCanvasToList } from "./list-transition.ts";
import { PresentationListAddressContext } from "./presentation-toolbar.tsx";

let presentationRoot: Root | undefined;

// One root keeps the slide and step across edits; a synchronous first render gives the list transition its canvas.
export function mountPresentation(presentationElement: ReactNode, presentationListAddress?: string) {
  const presentationTree = (
    <StrictMode>
      <PresentationListAddressContext value={presentationListAddress}>{presentationElement}</PresentationListAddressContext>
    </StrictMode>
  );
  if (presentationRoot !== undefined) {
    presentationRoot.render(presentationTree);
    return;
  }
  presentationRoot = createRoot(document.getElementById("slidemachina")!);
  if (presentationListAddress !== undefined) connectCanvasToList(presentationListAddress);
  flushSync(() => presentationRoot!.render(presentationTree));
}
