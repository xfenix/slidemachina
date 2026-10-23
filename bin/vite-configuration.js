import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { allowedFolders, engineResolution } from "./engine-resolution.js";
import { listModuleId } from "./entry-modules.js";
import { imageCompressionPlugin } from "./image-compression.js";
import { createPresentationPageHtml, pageFileName, slidemachinaPlugin } from "./page-serving.js";
import { renderListPage } from "./presentation-list-page.js";
import { slideSourcePlugin } from "./slide-source-plugin.js";

/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {import("vite").ServerOptions} serverOptions
 * @returns {import("vite").InlineConfig}
 */
export function createViteConfiguration(siteLayout, serverOptions) {
  return {
    configFile: false,
    root: siteLayout.rootFolder,
    plugins: [slideSourcePlugin(siteLayout), react(), tailwindcss(), slidemachinaPlugin(siteLayout, undefined)],
    resolve: engineResolution,
    // SLIDEMACHINA_AGENTATION=off turns the notes toolbar off, as the tests do.
    define: { "import.meta.env.SLIDEMACHINA_AGENTATION": JSON.stringify(process.env.SLIDEMACHINA_AGENTATION ?? "on") },
    // The engine ships as TypeScript: Vite compiles it like project code and pre-bundles only CommonJS dependencies.
    optimizeDeps: {
      // A repository may hold old reveal.js pages next to the presentations: dependencies are looked up from presentations only.
      ...(siteLayout.isRepository ? { entries: ["*/index.tsx"] } : {}),
      exclude: ["slidemachina"],
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "agentation",
        // Found only when the first scene loads; listed here, so Vite does not reload the page to bundle them mid-talk.
        "three",
        "three/examples/jsm/environments/RoomEnvironment.js",
        "three/examples/jsm/geometries/RoundedBoxGeometry.js",
      ],
    },
    server: {
      ...serverOptions,
      fs: { allow: allowedFolders(siteLayout) },
    },
  };
}

// One file inlines everything, a folder keeps files next to index.html; given list HTML, the page is the repository list.
/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {string} buildFolder
 * @param {boolean} isSingleFile
 * @param {import("./image-compression.js").BuildReport} buildReport
 * @param {string} [listPageHtml]
 * @returns {import("vite").InlineConfig}
 */
export function createBuildConfiguration(siteLayout, buildFolder, isSingleFile, buildReport, listPageHtml) {
  const builtPageHtml = listPageHtml ?? createPresentationPageHtml(siteLayout, siteLayout.rootFolder);
  return {
    configFile: false,
    root: siteLayout.rootFolder,
    mode: "production",
    logLevel: "warn",
    base: "./",
    plugins: [
      slideSourcePlugin(siteLayout),
      react(),
      tailwindcss(),
      slidemachinaPlugin(siteLayout, builtPageHtml),
      imageCompressionPlugin(buildReport),
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
/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {string} buildFolder
 * @param {import("./presentation-list-page.js").ListedCard[]} builtCards
 * @returns {import("vite").InlineConfig}
 */
export function createListBuildConfiguration(siteLayout, buildFolder, builtCards) {
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
