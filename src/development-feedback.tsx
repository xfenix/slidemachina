import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

const feedbackServerAddress = "http://localhost:4747";
// A note carries the place in index.tsx of the element it was left on.
const noteAttributes = ["data-source-location"];

// The condition is folded at build time, so a built presentation carries no Agentation code at all.
const AgentationToolbar = lazy(() =>
  import.meta.env.DEV
    ? import("agentation").then((agentationModule) => ({ default: agentationModule.Agentation }))
    : Promise.resolve({ default: () => null }),
);

const feedbackHostClass = "slidemachina-feedback";
// Agentation keeps its button in an open shadow root; these rules make it look like the other toolbar buttons.
const feedbackButtonStyles = `
  [class*="toolbarContainer"][class*="collapsed"] { background: transparent; box-shadow: none; }
  [class*="toolbarContainer"][class*="collapsed"]:hover { background: rgb(255 255 255 / 0.1); }
  [class*="toolbarContainer"][class*="collapsed"] [class*="toggleContent"] { color: var(--toolbar-icon-color); transition: color 0.2s; }
  [class*="toolbarContainer"][class*="collapsed"]:hover [class*="toggleContent"] { color: #fff; }
`;

// True while Agentation is open: the toolbar must not fade under a note being written.
export function isFeedbackActive(): boolean {
  const feedbackRoot = document.querySelector(`.${feedbackHostClass}`)?.shadowRoot;
  return feedbackRoot?.querySelector('[class*="toolbarContainer"]:not([class*="collapsed"])') != null;
}

// Agentation attaches its shadow root after it loads, so the styles wait for it.
function styleFeedbackButton(): () => void {
  let waitingFrame = requestAnimationFrame(function addStylesWhenReady() {
    const feedbackRoot = document.querySelector(`.${feedbackHostClass}`)?.shadowRoot;
    if (feedbackRoot === null || feedbackRoot === undefined) {
      waitingFrame = requestAnimationFrame(addStylesWhenReady);
      return;
    }
    if (feedbackRoot.querySelector("[data-slidemachina-styles]") !== null) return;
    const buttonStyleElement = document.createElement("style");
    buttonStyleElement.dataset.slidemachinaStyles = "";
    buttonStyleElement.textContent = feedbackButtonStyles;
    feedbackRoot.append(buttonStyleElement);
  });
  return () => cancelAnimationFrame(waitingFrame);
}

// Without its server Agentation would retry on every slide change; the dev server is asked once, then notes stay in the browser.
let feedbackServerCheck: Promise<boolean> | undefined;

function checkFeedbackServer() {
  feedbackServerCheck ??= fetch("/@slidemachina/feedback-server")
    .then((checkResponse) => checkResponse.json())
    .then((checkAnswer: { isAnswering?: boolean }) => checkAnswer.isAnswering === true, () => false);
  return feedbackServerCheck;
}

// Notes reach the coding agent through agentation-mcp; the button sits over an empty toolbar slot.
export function DevelopmentFeedback() {
  const toolbarSlotReference = useRef<HTMLSpanElement>(null);
  const [hasFeedbackServer, setFeedbackServer] = useState<boolean>();

  useEffect(() => {
    let isOutdated = false;
    void checkFeedbackServer().then((isAnswering) => isOutdated || setFeedbackServer(isAnswering));
    return () => {
      isOutdated = true;
    };
  }, []);

  useEffect(() => (hasFeedbackServer === undefined ? undefined : styleFeedbackButton()), [hasFeedbackServer]);

  // Runs after every render: the toolbar moves when the window is resized and the canvas is rescaled.
  useLayoutEffect(() => {
    const toolbarSlotFrame = toolbarSlotReference.current?.getBoundingClientRect();
    if (toolbarSlotFrame === undefined) return;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--feedback-right", `${window.innerWidth - toolbarSlotFrame.right}px`);
    rootStyle.setProperty("--feedback-bottom", `${window.innerHeight - toolbarSlotFrame.bottom}px`);
  });

  return (
    <>
      <span data-toolbar-slot ref={toolbarSlotReference}>
        <FeedbackIcon />
      </span>
      {hasFeedbackServer !== undefined && (
        <Suspense fallback={null}>
          <AgentationToolbar
            className={feedbackHostClass}
            endpoint={hasFeedbackServer ? feedbackServerAddress : undefined}
            useHashLocation
            identifyingAttributes={noteAttributes}
          />
        </Suspense>
      )}
    </>
  );
}

// Stands in for the Agentation button while a transition moves the page root it lives in.
function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 6.75H18.5M5.5 12H11.5M5.5 17.25H9.25" />
      <path d="M16 12.75L16.5179 13.9677C16.8078 14.6494 17.3506 15.1922 18.0323 15.4821L19.25 16L18.0323 16.5179C17.3506 16.8078 16.8078 17.3506 16.5179 18.0323L16 19.25L15.4821 18.0323C15.1922 17.3506 14.6494 16.8078 13.9677 16.5179L12.75 16L13.9677 15.4821C14.6494 15.1922 15.1922 14.6494 15.4821 13.9677L16 12.75Z" />
    </svg>
  );
}
