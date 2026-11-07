import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { listAllowedFolders, engineResolution, enginePackageFolder } from "./engine-resolution.ts";
import { listModuleId } from "./entry-modules.ts";
import { describeEnginePrebundling } from "./engine-prebundling.ts";
import { createImageCompressionPlugin } from "../presentation-build/image-compression.ts";
import { createPresentationPageHtml, pageFileName, createSlidemachinaPlugin } from "./page-serving.ts";
import { createInlineBuiltAssetsPlugin } from "./inline-built-assets.ts";
import { renderListPage } from "../presentation-repository/presentation-list-page.ts";
import { createSlideSourcePlugin } from "../source-transforms/slide-source-plugin.ts";
import { createElkWorkerStubPlugin } from "../presentation-build/elk-worker-stub.ts";
import { presentationFileName } from "../presentation-repository/presentation-repository.ts";
import type { InlineConfig, ServerOptions } from "vite";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";
import type { BuildReport } from "../presentation-build/image-compression.ts";
import type { ListedCard } from "../presentation-repository/presentation-list-page.ts";

// Fast Refresh takes a module whose exports are all components; index.tsx exports an element and would reload the page
// as soon as it holds a component of its own. Without Fast Refresh the entry renders the new element into the same root:
// slide and step stay, the components of index.tsx start afresh.
const presentationFilePattern = new RegExp(`/${presentationFileName.replaceAll(".", "\\.")}$`);
const refreshedFilesExclusion = [/\/node_modules\//, presentationFilePattern];

export function createViteConfiguration(siteLayout: SiteLayout, serverOptions: ServerOptions): InlineConfig {
  const enginePrebundling = describeEnginePrebundling();
  return {
    configFile: false,
    root: siteLayout.rootFolder,
    plugins: [createSlideSourcePlugin(siteLayout), react({ compiler: true, exclude: refreshedFilesExclusion }), tailwindcss(), createSlidemachinaPlugin(siteLayout, undefined)],
    resolve: engineResolution,
    // SLIDEMACHINA_AGENTATION=off turns the notes toolbar off, as the tests do.
    define: { "import.meta.env.SLIDEMACHINA_AGENTATION": JSON.stringify(process.env.SLIDEMACHINA_AGENTATION ?? "on") },
    optimizeDeps: {
      // There is no index.html to scan: the presentation files are the entries, so dependencies they import, even lazily,
      // are bundled before the first page instead of reloading it mid-talk. A repository may hold old reveal.js pages
      // next to the presentations: dependencies are looked up from presentations only.
      entries: [siteLayout.isRepository ? `*/${presentationFileName}` : presentationFileName],
      // The scanner and the include list know every optimized import: the browser can start before the whole crawl ends.
      holdUntilCrawlEnd: false,
      ...enginePrebundling,
      include: [
        ...enginePrebundling.include,
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        // Recharts pulls a CommonJS store shim that Vite must convert before the browser reads it.
        "recharts",
        // The QR block is engine code, which the scan skips: found late, it would reload the page on the first start.
        "uqr",
      ],
    },
    server: {
      ...serverOptions,
      fs: { allow: listAllowedFolders(siteLayout) },
    },
  };
}

// One file inlines everything, a folder keeps files next to index.html; given list HTML, the page is the repository list.
export function createBuildConfiguration(siteLayout: SiteLayout, buildFolder: string, isSingleFile: boolean, buildReport: BuildReport, listPageHtml?: string): InlineConfig {
  const builtPageHtml = listPageHtml ?? createPresentationPageHtml(siteLayout, siteLayout.rootFolder);
  return {
    configFile: false,
    root: siteLayout.rootFolder,
    mode: "production",
    logLevel: "warn",
    base: "./",
    plugins: [
      createSlideSourcePlugin(siteLayout),
      react({ compiler: true }),
      tailwindcss(),
      createElkWorkerStubPlugin(siteLayout.rootFolder),
      createSlidemachinaPlugin(siteLayout, builtPageHtml),
      createImageCompressionPlugin(buildReport),
      // The list keeps its stylesheet file: only a presentation page paints its cover before scripts and needs the styles inside the HTML.
      listPageHtml === undefined && createInlineBuiltAssetsPlugin(buildFolder),
      isSingleFile && viteSingleFile({ removeViteModuleLoader: true }),
    ],
    resolve: engineResolution,
    build: {
      outDir: buildFolder,
      emptyOutDir: true,
      reportCompressedSize: false,
      rollupOptions: { input: path.join(siteLayout.rootFolder, pageFileName) },
    },
  };
}

// The list of a built repository: a page with styles only, covers are pictures next to each presentation.
export function createListBuildConfiguration(siteLayout: SiteLayout, buildFolder: string, builtCards: ListedCard[]): InlineConfig {
  const emptyReport = { savedPictureBytes: new Map(), videoSizes: new Map() };
  const listConfiguration = createBuildConfiguration(siteLayout, buildFolder, false, emptyReport, renderListPage(builtCards, listModuleId));
  // The list only needs its stylesheet: no preload helper, and no crossorigin, which a page opened from disk refuses.
  return {
    ...listConfiguration,
    build: { ...listConfiguration.build, modulePreload: { polyfill: false } },
    plugins: [
      ...(listConfiguration.plugins ?? []),
      {
        name: "slidemachina-list-page",
        enforce: "post",
        transformIndexHtml: (builtHtml) => builtHtml.replaceAll(" crossorigin", ""),
      },
    ],
  };
}

const remotePageVirtualPath = path.join(enginePackageFolder, "remote.html");
const remoteMountingModuleId = "/@slidemachina/remote-mounting.js";
const remotePageHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>slidemachina · remote</title>
  </head>
  <body>
    <div id="slidemachina"></div>
    <script type="module" src="${remoteMountingModuleId}"></script>
  </body>
</html>`;

// The standalone remote page as one inlined HTML file: the phone opens it from any static hosting to join a talk.
export function createRemotePageBuildConfiguration(remoteHtmlPath: string): InlineConfig {
  return {
    configFile: false,
    root: enginePackageFolder,
    mode: "production",
    logLevel: "warn",
    base: "./",
    plugins: [
      react({ compiler: true }),
      viteSingleFile({ removeViteModuleLoader: true }),
      {
        name: "slidemachina-remote-page",
        resolveId(requestedModuleId) {
          if (requestedModuleId === remotePageVirtualPath) return remotePageVirtualPath;
          return requestedModuleId === remoteMountingModuleId ? "\0" + remoteMountingModuleId : undefined;
        },
        load(loadedModuleId) {
          if (loadedModuleId === remotePageVirtualPath) return remotePageHtml;
          if (loadedModuleId === "\0" + remoteMountingModuleId)
            return `import { mountRemoteClientScreen } from "slidemachina/remote-mounting";\nmountRemoteClientScreen();`;
          return undefined;
        },
      },
    ],
    resolve: engineResolution,
    build: {
      outDir: path.dirname(remoteHtmlPath),
      emptyOutDir: false,
      reportCompressedSize: false,
      rollupOptions: { input: remotePageVirtualPath },
    },
  };
}
