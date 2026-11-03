import { backgroundLoadingPause, idleCallbackTimeout } from "./settings.ts";

let backgroundLoadingRequest: Promise<void> | undefined;
let lastBackgroundTurn: Promise<void> | undefined;

// Safari has no requestIdleCallback; there the next task does.
function waitForIdleMoment(): Promise<void> {
  return new Promise((resolveIdleMoment) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => resolveIdleMoment(), { timeout: idleCallbackTimeout });
    else setTimeout(resolveIdleMoment);
  });
}

function waitForBackgroundLoading(): Promise<void> {
  backgroundLoadingRequest ??= new Promise<void>((resolvePause) => {
    const startPause = () => setTimeout(resolvePause, backgroundLoadingPause);
    if (document.readyState === "complete") startPause();
    else window.addEventListener("load", startPause, { once: true });
  });
  return backgroundLoadingRequest;
}

// Background tasks run one per idle moment, not all in one task: a key pressed meanwhile waits for one task, not for the whole talk.
export function waitForBackgroundTurn(): Promise<void> {
  lastBackgroundTurn = (lastBackgroundTurn ?? waitForBackgroundLoading()).then(waitForIdleMoment);
  return lastBackgroundTurn;
}

// One piece of background work per idle moment, after the heavy parts may start; the returned callback cancels the task.
export function runInIdleBackgroundTurn(backgroundTask: () => void): () => void {
  let isTaskCancelled = false;
  void waitForBackgroundTurn().then(() => {
    if (!isTaskCancelled) backgroundTask();
  });
  return () => {
    isTaskCancelled = true;
  };
}
