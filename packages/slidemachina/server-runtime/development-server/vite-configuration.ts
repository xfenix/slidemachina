import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { listAllowedFolders, engineResolution } from "./engine-resolution.ts";
import { listModuleId } from "./entry-modules.ts";
import { createImageCompressionPlugin } from "../presentation-build/image-compression.ts";
import { createPresentationPageHtml, pageFileName, createSlidemachinaPlugin } from "./page-serving.ts";
import { renderListPage } from "../presentation-repository/presentation-list-page.ts";
import { createSlideSourcePlugin } from "../source-transforms/slide-source-plugin.ts";
import type { InlineConfig, ServerOptions } from "vite";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";
import type { BuildReport } from "../presentation-build/image-compression.ts";
import type { ListedCard } from "../presentation-repository/presentation-list-page.ts";

export function createViteConfiguration(siteLayout: SiteLayout, serverOptions: ServerOptions): InlineConfig {
  return {
    configFile: false,
    root: siteLayout.rootFolder,
    plugins: [createSlideSourcePlugin(siteLayout), react({ compiler: true }), tailwindcss(), createSlidemachinaPlugin(siteLayout, undefined)],
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
      createSlidemachinaPlugin(siteLayout, builtPageHtml),
      createImageCompressionPlugin(buildReport),
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
