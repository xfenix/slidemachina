import path from "node:path";
import { createEntryModuleCode, createListModuleCode, nameEntryModuleId, entryModulePrefix, listModuleId } from "./entry-modules.ts";
import { installFeedbackServerCheck } from "./feedback-server-check.ts";
import { escapeHtml } from "../presentation-build/html-escaping.ts";
import { createDevelopmentListPage, pageTransitionStyle } from "../presentation-repository/presentation-list-page.ts";
import { listPresentationFolders } from "../presentation-repository/presentation-repository.ts";
import type { Plugin } from "vite";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export const pageFileName = "index.html";
const redirectStatus = 302;

export function createPresentationPageHtml(siteLayout: SiteLayout, presentationFolder: string): string {
  const scriptModuleId = nameEntryModuleId(siteLayout, presentationFolder);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="data:," />
    ${pageTransitionStyle}
  </head>
  <body>
    <div id="slidemachina"></div>
    <script type="module" src="${escapeHtml(scriptModuleId)}"></script>
  </body>
</html>`;
}

function findRequestedPresentation(siteLayout: SiteLayout, requestedPath: string): { presentationFolder: string, hasTrailingPart: boolean } | undefined {
  const pageMatch = /^\/([^/]+)(\/|\/index\.html)?$/.exec(requestedPath);
  if (pageMatch === null) return undefined;
  let folderName;
  try {
    folderName = decodeURIComponent(pageMatch[1]);
  } catch {
    return undefined;
  }
  const presentationFolder = listPresentationFolders(siteLayout.rootFolder).find((candidateFolder) => path.basename(candidateFolder) === folderName);
  return presentationFolder === undefined ? undefined : { presentationFolder, hasTrailingPart: pageMatch[2] !== undefined };
}

// The pages have no files on disk: the dev server sends them, the build takes one as its input.
export function createSlidemachinaPlugin(siteLayout: SiteLayout, builtPageHtml: string | undefined): Plugin {
  const pagePath = path.join(siteLayout.rootFolder, pageFileName);
  const isVirtualModule = (requestedModuleId: string) =>
    requestedModuleId === listModuleId || (requestedModuleId.startsWith(entryModulePrefix) && requestedModuleId.endsWith(".js"));
  let isDevelopment = false;
  return {
    name: "slidemachina",
    configResolved(resolvedConfiguration) {
      isDevelopment = resolvedConfiguration.command === "serve";
    },
    resolveId(requestedModuleId) {
      if (requestedModuleId === pagePath) return pagePath;
      return isVirtualModule(requestedModuleId) ? "\0" + requestedModuleId : undefined;
    },
    load(loadedModuleId) {
      if (loadedModuleId === pagePath) return builtPageHtml;
      if (!loadedModuleId.startsWith("\0")) return undefined;
      const virtualModuleId = loadedModuleId.slice(1);
      if (virtualModuleId === listModuleId) return createListModuleCode(siteLayout);
      if (!isVirtualModule(virtualModuleId)) return undefined;
      const presentationFolder = path.join(siteLayout.rootFolder, virtualModuleId.slice(entryModulePrefix.length, -".js".length));
      return createEntryModuleCode(siteLayout, presentationFolder, isDevelopment);
    },
    configureServer(developmentServer) {
      installFeedbackServerCheck(developmentServer);
      // Connect does not wait for a promise: a failed page goes to Vite's error handler instead of stopping the server.
      developmentServer.middlewares.use((incomingRequest, serverResponse, nextMiddleware) => {
        const servePage = async () => {
          const requestedUrl = incomingRequest.url ?? "/";
          const requestedAddress = new URL(requestedUrl, "http://localhost");
          const requestedPath = requestedAddress.pathname;
          const sendPage = async (pageHtml: string) => {
            serverResponse.setHeader("Content-Type", "text/html; charset=utf-8");
            serverResponse.end(await developmentServer.transformIndexHtml(requestedUrl, pageHtml));
          };
          const isSiteRoot = requestedPath === "/" || requestedPath === "/index.html";
          if (!siteLayout.isRepository) {
            return isSiteRoot ? sendPage(createPresentationPageHtml(siteLayout, siteLayout.rootFolder)) : nextMiddleware();
          }
          if (isSiteRoot) return sendPage(createDevelopmentListPage(siteLayout, listModuleId));
          const requestedPresentation = findRequestedPresentation(siteLayout, requestedPath);
          if (requestedPresentation === undefined) return nextMiddleware();
          // Relative links on the page need the trailing slash: /talk → /talk/.
          if (!requestedPresentation.hasTrailingPart) {
            serverResponse.writeHead(redirectStatus, { Location: `${requestedPath}/${requestedAddress.search}` });
            return serverResponse.end();
          }
          return sendPage(createPresentationPageHtml(siteLayout, requestedPresentation.presentationFolder));
        };
        servePage().catch(nextMiddleware);
      });
    },
  };
}
