import { useEffect, useState } from "react";
import type { SlideNumbering } from "../../shared-between-runtimes/slide-numbering.ts";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";
import type { SlideCommand } from "../presenter-view/presenter-channel.ts";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";
import { readStoredHostingCode, storeHostingCode, useRemoteConnection, useRemoteHosting } from "./remote-channel.ts";

export type RemoteControlHostingOptions = {
  isHostingAvailable: boolean;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  runSlideCommand: (slideCommand: SlideCommand) => void;
  languageCode: string;
  slideNumbering: SlideNumbering;
  countSlideSteps: (slideIndex: number) => number;
};

// The slides window hosts a code from the panel; a phone on the same domain enters it and sends commands to this channel.
export function useRemoteControlHosting({
  isHostingAvailable,
  currentPosition,
  isPaused,
  runSlideCommand,
  languageCode,
  slideNumbering,
  countSlideSteps,
}: RemoteControlHostingOptions) {
  const [hostingCode, changeHostingCode] = useState(readStoredHostingCode);
  useEffect(() => {
    storeHostingCode(hostingCode);
  }, [hostingCode]);
  const { connectedRemoteCount } = useRemoteHosting({
    isHostingAvailable,
    hostingCode,
    currentPosition,
    isPaused,
    runSlideCommand,
  });
  const remoteConnection = useRemoteConnection();
  const describeFollowedPosition = (followedSlideIndex: number, followedStepIndex: number) => {
    const remoteInterfaceTexts = pickInterfaceTexts(languageCode);
    const shownSlideNumber = slideNumbering.shownNumbers[followedSlideIndex] ?? followedSlideIndex + 1;
    const followedStepCount = countSlideSteps(followedSlideIndex);
    return {
      slideText: remoteInterfaceTexts.presenterSlideCounter(shownSlideNumber, slideNumbering.shownSlideIndexes.length),
      stepText: followedStepCount > 0 ? remoteInterfaceTexts.presenterStepCounter(followedStepIndex, followedStepCount) : undefined,
    };
  };
  return { hostingCode, changeHostingCode, connectedRemoteCount, describeFollowedPosition, ...remoteConnection };
}
