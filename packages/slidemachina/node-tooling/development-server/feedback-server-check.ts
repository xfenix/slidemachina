import type { ViteDevServer } from "vite";

const feedbackServerAddress = "http://localhost:4747";
const feedbackCheckEndpoint = "/@slidemachina/feedback-server";

// The page asks here, not Agentation's server itself: a refused connection would leave an error in the browser console.
export function installFeedbackServerCheck(developmentServer: ViteDevServer): void {
  developmentServer.middlewares.use(feedbackCheckEndpoint, async (_incomingRequest, serverResponse) => {
    const isAnswering = await fetch(`${feedbackServerAddress}/health`, { signal: AbortSignal.timeout(1000) }).then(
      (healthResponse) => healthResponse.ok,
      () => false,
    );
    serverResponse.setHeader("Content-Type", "application/json");
    serverResponse.end(JSON.stringify({ isAnswering }));
  });
}
