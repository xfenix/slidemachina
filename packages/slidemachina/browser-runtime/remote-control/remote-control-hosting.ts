import { useEffect, useMemo, useState } from "react";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import { findShownSlide } from "../../shared-between-runtimes/slide-numbering.ts";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { buildRemoteJoinLink } from "./remote-join-link.ts";
import { createRemoteCode, isCompleteRemoteCode, readStoredHostingCode, storeHostingCode, useRemoteConnection, useRemoteHosting } from "./remote-channel.ts";
import { useShortenedJoinLink } from "./remote-short-link.ts";

export type RemoteControlHostingOptions = {
  isHostingAvailable: boolean;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  presentationTitle: string | undefined;
  runSlideCommand: (slideCommand: SlideCommand) => void;
  slideNumbering: SlideNumbering;
  countSlideSteps: (slideIndex: number) => number;
};

// One field is the whole panel: it shows the code of this screen, and typing another screen's code over it makes
// this window a remote for that code. Hosting always runs on this tab's own code, so a remote never executes its own commands.
export function useRemoteControlHosting({
  isHostingAvailable,
  currentPosition,
  isPaused,
  presentationTitle,
  runSlideCommand,
  slideNumbering,
  countSlideSteps,
}: RemoteControlHostingOptions) {
  const [isRemoteAccessEnabled, setIsRemoteAccessEnabled] = useState(true);
  const [ownCode, setOwnCode] = useState(readStoredHostingCode);
  const [panelCode, setPanelCode] = useState(ownCode);
  const [hostingEpoch, setHostingEpoch] = useState(0);
  useEffect(() => {
    storeHostingCode(ownCode);
  }, [ownCode]);
  const isRemoteMode = panelCode !== ownCode;
  const targetCode = isRemoteMode && isCompleteRemoteCode(panelCode) ? panelCode : undefined;
  const describeSlideCaption = (slideIndex: number, stepIndex: number) => ({
    shownSlideNumber: slideNumbering.shownNumbers[slideIndex] ?? slideIndex + 1,
    shownSlideCount: slideNumbering.shownSlideIndexes.length,
    stepIndex,
    stepCount: countSlideSteps(slideIndex),
  });
  // A remote knows shown numbers only and never hears about hidden slides; the host turns a typed number into
  // a slide index, and a number past the end lands on the last slide like the typed numbers on the keyboard.
  const runHostedSlideCommand = (slideCommand: SlideCommand) =>
    runSlideCommand(typeof slideCommand === "number" ? findShownSlide(slideNumbering, slideCommand) : slideCommand);
  const { connectedRemoteCount, hostingReachability } = useRemoteHosting({
    isHostingAvailable: isHostingAvailable && isRemoteAccessEnabled,
    hostingCode: ownCode,
    hostingEpoch,
    currentPosition,
    isPaused,
    presentationTitle,
    describeSlideCaption,
    runSlideCommand: runHostedSlideCommand,
  });
  const remoteConnection = useRemoteConnection(targetCode);
  const hostingLink = useMemo(() => buildRemoteJoinLink(ownCode), [ownCode]);
  const typableJoinLink = useShortenedJoinLink(hostingLink);

  // Turning the access back on after an off spell issues a fresh code: a captured QR or a peeked code stays dead.
  // The field follows the code: the panel stays in the hosting state instead of becoming a remote of itself.
  const changeRemoteAccessEnabled = (isEnabled: boolean) => {
    if (isEnabled) {
      const freshCode = createRemoteCode();
      setOwnCode(freshCode);
      setPanelCode(freshCode);
    }
    setIsRemoteAccessEnabled(isEnabled);
  };
  // Drops every connected remote and reopens the same code on the broker; the phones see the lost connection.
  const disconnectConnectedRemotes = () => setHostingEpoch((currentEpoch) => currentEpoch + 1);

  return {
    panelCode,
    changePanelCode: setPanelCode,
    isRemoteMode,
    isRemoteAccessEnabled,
    changeRemoteAccessEnabled,
    disconnectConnectedRemotes,
    hostingLink,
    typableJoinLink,
    connectedRemoteCount,
    hostingReachability,
    disconnectFromHostingScreen: () => setPanelCode(ownCode),
    ...remoteConnection,
  };
}
