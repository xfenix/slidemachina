import { memeSearchEndpoint } from "../../shared-between-runtimes/engine-constants.ts";
import { isOwnPageRequest } from "./edit-request-checks.ts";
import { SourceEditProblem } from "./source-rewriting.ts";
import { isGiphyOn, searchGiphyClips } from "../meme-sources/giphy-clips.ts";
import { searchMemeTemplates } from "../meme-sources/memegen-templates.ts";
import type { MemeSearchAnswer } from "../../shared-between-runtimes/meme-template.ts";
import type { ViteDevServer } from "vite";

const successStatus = 200;
const foreignOriginStatus = 403;
const failedSearchStatus = 502;

// Only the page of this dev server may search: the GIPHY key has a limit of requests an hour.
export function installMemeSearch(developmentServer: ViteDevServer): void {
  developmentServer.middlewares.use(memeSearchEndpoint, (incomingRequest, serverResponse) => {
    const sendAnswer = (statusCode: number, answerBody: object) => {
      serverResponse.statusCode = statusCode;
      serverResponse.setHeader("Content-Type", "application/json");
      serverResponse.end(JSON.stringify(answerBody));
    };
    if (!isOwnPageRequest(incomingRequest)) return sendAnswer(foreignOriginStatus, { problemCode: "wrongRequest" });
    const searchQuery = new URL(incomingRequest.url ?? "", "http://localhost").searchParams.get("query") ?? "";
    // GIPHY failing, say past its hourly limit, leaves the templates found.
    const giphySearch = searchGiphyClips(searchQuery).catch((giphyError: unknown) => {
      developmentServer.config.logger.warn(`GIPHY: ${giphyError instanceof Error ? giphyError.message : String(giphyError)}`);
      return [];
    });
    void Promise.all([searchMemeTemplates(searchQuery), giphySearch]).then(
      ([memeTemplates, giphyClips]) => sendAnswer(successStatus, { memeTemplates, giphyClips, isGiphyOn: isGiphyOn() } satisfies MemeSearchAnswer),
      (searchError: unknown) => {
        if (!(searchError instanceof SourceEditProblem)) developmentServer.config.logger.error(String(searchError));
        sendAnswer(failedSearchStatus, { problemCode: searchError instanceof SourceEditProblem ? searchError.problemCode : "memeNetworkFailed" });
      },
    );
  });
}
