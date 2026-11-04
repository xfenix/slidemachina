import { useEffect, useState } from "react";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.js";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { SlidemachinaLogo } from "../presentation-core/slidemachina-logo.tsx";
import { isCompleteRemoteCode, normalizeTypedCode, useRemoteConnection } from "./remote-channel.ts";
import { RemoteClientView } from "./remote-client-view.tsx";

const hapticsStorageKey = "slidemachina-remote-haptics";
const hapticPulseDurationMs = 12;

// The standalone phone page: opened from the QR code of a presenting screen with the connection code after # in
// the address, so the phone connects without typing. The interface speaks the language of the phone itself.
export function RemoteClientScreen() {
  const screenLanguage = pickTextLanguage(navigator.language);
  const interfaceTexts = pickInterfaceTexts(navigator.language);
  const [panelCode, setPanelCode] = useState(readHashRemoteCode);
  const [isHapticsEnabled, setHapticsEnabled] = useState(readStoredHapticsPreference);
  const targetCode = isCompleteRemoteCode(panelCode) ? panelCode : undefined;
  const remoteConnection = useRemoteConnection(targetCode);
  useEffect(() => {
    document.documentElement.lang = screenLanguage;
    document.title = interfaceTexts.remotePageTitle;
    const followHashChange = () => setPanelCode(readHashRemoteCode());
    window.addEventListener("hashchange", followHashChange);
    return () => window.removeEventListener("hashchange", followHashChange);
  }, [screenLanguage, interfaceTexts]);

  const givePressFeedback = () => {
    if (isHapticsEnabled && "vibrate" in navigator) navigator.vibrate(hapticPulseDurationMs);
  };
  const toggleHaptics = () =>
    setHapticsEnabled((wasHapticsEnabled) => {
      const isHapticsOnNow = !wasHapticsEnabled;
      localStorage.setItem(hapticsStorageKey, isHapticsOnNow ? "on" : "off");
      return isHapticsOnNow;
    });
  const disconnectFromHostingScreen = () => {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    setPanelCode("");
  };

  return (
    <div data-remote-screen>
      <SlidemachinaLogo dark />
      {remoteConnection.followedPresentationTitle !== undefined && <h1 data-remote-title>{remoteConnection.followedPresentationTitle}</h1>}
      <fieldset data-remote-panel data-remote-mode="remote" aria-label={interfaceTexts.remoteButton}>
        <RemoteClientView
          languageCode={navigator.language}
          panelCode={panelCode}
          changePanelCode={setPanelCode}
          disconnectFromHostingScreen={disconnectFromHostingScreen}
          givePressFeedback={givePressFeedback}
          {...remoteConnection}
        />
        <label data-remote-haptics>
          <input type="checkbox" checked={isHapticsEnabled} onChange={toggleHaptics} />
          <span data-remote-toggle-track>
            <span data-remote-toggle-thumb />
          </span>
          {interfaceTexts.remoteHapticsLabel}
        </label>
      </fieldset>
    </div>
  );
}

function readHashRemoteCode(): string {
  return normalizeTypedCode(location.hash.slice(1));
}

function readStoredHapticsPreference(): boolean {
  return localStorage.getItem(hapticsStorageKey) !== "off";
}
