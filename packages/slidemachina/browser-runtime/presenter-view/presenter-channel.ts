import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { PresentationPosition } from "../slide-navigation/position-hash.ts";

// A slide index jumps to that slide.
export type SlideCommand = "forward" | "backward" | "pause" | number;
// The slides window leads, the presenter window follows: one place counts steps and plays transitions.
export type WindowRole = "audience" | "presenter" | "alone";
type ChannelMessage =
  | { messageKind: "position"; slidePosition: PresentationPosition; isPaused: boolean }
  | { messageKind: "command"; slideCommand: SlideCommand }
  | { messageKind: "greeting" }
  | { messageKind: "farewell" };
type PresenterSyncOptions = {
  windowRole: WindowRole;
  currentPosition: PresentationPosition;
  isPaused: boolean;
  runSlideCommand: (slideCommand: SlideCommand) => void;
  followAudience: (slidePosition: PresentationPosition, isPaused: boolean) => void;
};

// The channel is named by the page path: two talks open side by side do not drive each other.
function nameChannel(): string {
  return `slidemachina-presenter:${location.pathname}`;
}

// BroadcastChannel reaches every window of the page, also a single file opened from disk in Chrome.
// The presenter window greets on load and the slides window answers with its position; keys in the presenter window become commands.
export function usePresenterSync({ windowRole, currentPosition, isPaused, runSlideCommand, followAudience }: PresenterSyncOptions) {
  const channelReference = useRef<BroadcastChannel>(undefined);
  const [isAudienceConnected, setAudienceConnected] = useState(false);
  const { slideIndex, stepIndex } = currentPosition;

  const postMessage = (channelMessage: ChannelMessage) => channelReference.current?.postMessage(channelMessage);
  const postPosition = useEffectEvent(() => postMessage({ messageKind: "position", slidePosition: { slideIndex, stepIndex }, isPaused }));
  const receiveMessage = useEffectEvent((channelMessage: ChannelMessage) => {
    if (windowRole === "audience") {
      if (channelMessage.messageKind === "greeting") postPosition();
      if (channelMessage.messageKind === "command") runSlideCommand(channelMessage.slideCommand);
      return;
    }
    if (channelMessage.messageKind === "position") {
      setAudienceConnected(true);
      followAudience(channelMessage.slidePosition, channelMessage.isPaused);
    }
    if (channelMessage.messageKind === "farewell") setAudienceConnected(false);
  });

  useEffect(() => {
    if (windowRole === "alone") return;
    const presenterChannel = new BroadcastChannel(nameChannel());
    channelReference.current = presenterChannel;
    presenterChannel.addEventListener("message", (messageEvent: MessageEvent<ChannelMessage>) => receiveMessage(messageEvent.data));
    // The slides window announces itself with its position in the effect below.
    if (windowRole === "presenter") presenterChannel.postMessage({ messageKind: "greeting" } satisfies ChannelMessage);
    const sayFarewell = () => windowRole === "audience" && presenterChannel.postMessage({ messageKind: "farewell" } satisfies ChannelMessage);
    window.addEventListener("pagehide", sayFarewell);
    return () => {
      window.removeEventListener("pagehide", sayFarewell);
      presenterChannel.close();
      channelReference.current = undefined;
    };
  }, [windowRole]);

  useEffect(() => {
    if (windowRole === "audience") postPosition();
  }, [windowRole, slideIndex, stepIndex, isPaused]);

  const isRemoteControl = windowRole === "presenter" && isAudienceConnected;
  return {
    isAudienceConnected,
    steerSlides: (slideCommand: SlideCommand) => (isRemoteControl ? postMessage({ messageKind: "command", slideCommand }) : runSlideCommand(slideCommand)),
  };
}
