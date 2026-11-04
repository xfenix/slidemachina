import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../visual-theme/engine-layout.css";
import "../visual-theme/default-theme.css";
import "./remote-panel.css";
import "./remote-screen.css";
import { RemoteClientScreen } from "./remote-client-screen.tsx";

// The standalone remote page and the ?remote mode of a presentation mount the same screen into the same root div.
export function mountRemoteClientScreen() {
  createRoot(document.getElementById("slidemachina")!).render(
    <StrictMode>
      <RemoteClientScreen />
    </StrictMode>,
  );
}
