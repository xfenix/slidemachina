import { useEffect, useState } from "react";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { isCompleteRemoteCode, readStoredHostingCode, storeHostingCode, useRemoteConnection, useRemoteHosting } from "./remote-channel.ts";

export type RemoteControlHostingOptions = {
  isHostingAvailable: boolean;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  runSlideCommand: (slideCommand: SlideCommand) => void;
  languageCode: string;
  slideNumbering: SlideNumbering;
  countSlideSteps: (slideIndex: number) => number;
};

// One field is the whole panel: it shows the code of this screen, and typing another screen's code over it makes
// this window a remote for that code. Hosting always runs on this tab's own code, so a remote never executes its own commands.
export function useRemoteControlHosting({
  isHostingAvailable,
  currentPosition,
  isPaused,
  runSlideCommand,
  languageCode,
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
  const { connectedRemoteCount } = useRemoteHosting({
    isHostingAvailable,
    hostingCode: ownCode,
    currentPosition,
    isPaused,
    runSlideCommand,
  });
  const remoteConnection = useRemoteConnection(targetCode);
  const describeFollowedPosition = (followedSlideIndex: number, followedStepIndex: number) => {
    const remoteInterfaceTexts = pickInterfaceTexts(languageCode);
    const shownSlideNumber = slideNumbering.shownNumbers[followedSlideIndex] ?? followedSlideIndex + 1;
    const followedStepCount = countSlideSteps(followedSlideIndex);
    return {
      slideText: remoteInterfaceTexts.presenterSlideCounter(shownSlideNumber, slideNumbering.shownSlideIndexes.length),
      stepText: followedStepCount > 0 ? remoteInterfaceTexts.presenterStepCounter(followedStepIndex, followedStepCount) : undefined,
    };
  };
  return {
    panelCode,
    changePanelCode: setPanelCode,
    isRemoteMode,
    connectedRemoteCount,
    describeFollowedPosition,
    disconnectFromHostingScreen: () => setPanelCode(ownCode),
    ...remoteConnection,
  };
}
