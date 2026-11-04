import { useEffect, useMemo, useState } from "react";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { buildRemoteJoinLink } from "./remote-join-link.ts";
import { isCompleteRemoteCode, readStoredHostingCode, storeHostingCode, useRemoteConnection, useRemoteHosting } from "./remote-channel.ts";

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
  const [ownCode] = useState(readStoredHostingCode);
  const [panelCode, setPanelCode] = useState(ownCode);
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
  const { connectedRemoteCount, hostingReachability } = useRemoteHosting({
    isHostingAvailable,
    hostingCode: ownCode,
    currentPosition,
    isPaused,
    presentationTitle,
    describeSlideCaption,
    runSlideCommand,
  });
  const remoteConnection = useRemoteConnection(targetCode);
  const hostingLink = useMemo(() => buildRemoteJoinLink(ownCode), [ownCode]);
  return {
    panelCode,
    changePanelCode: setPanelCode,
    isRemoteMode,
    hostingLink,
    connectedRemoteCount,
    hostingReachability,
    disconnectFromHostingScreen: () => setPanelCode(ownCode),
    ...remoteConnection,
  };
}
