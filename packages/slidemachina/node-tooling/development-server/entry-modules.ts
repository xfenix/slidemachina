import { existsSync } from "node:fs";
import path from "node:path";
import { enginePackageFolder } from "./engine-resolution.ts";
import { presentationFileName, toSitePath } from "../presentation-repository/presentation-repository.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export const entryModulePrefix = "/@slidemachina/entry";
export const listModuleId = "/@slidemachina/presentation-list.js";
// Paths are relative to the engine package; the order is the cascade order.
const engineStylesheets = [
  "browser-runtime/visual-theme/engine-layout.css",
  "browser-runtime/presentation-interface/slide-navigator.css",
  "browser-runtime/presentation-interface/presentation-toolbar.css",
  "browser-runtime/presentation-interface/print-menu.css",
  "browser-runtime/slide-printing/print-layout.css",
  "browser-runtime/slide-transitions/slide-transitions.css",
  "browser-runtime/visual-theme/default-theme.css",
  "browser-runtime/content-blocks/content-blocks.css",
  "browser-runtime/content-blocks/media-frame.css",
  "browser-runtime/content-blocks/caption-component.css",
  "browser-runtime/content-blocks/source-component.css",
  "browser-runtime/content-blocks/columns-component.css",
  "browser-runtime/content-blocks/table-component.css",
  "browser-runtime/content-blocks/quote-component.css",
  "browser-runtime/content-blocks/big-number-component.css",
  "browser-runtime/code-blocks/code-component.css",
  "browser-runtime/diagram-blocks/diagram-component.css",
  "browser-runtime/diagram-blocks/sequence-component.css",
  "browser-runtime/scene-blocks/scene-component.css",
];
// The editor exists only in slidemachina dev, so a build leaves its styles out.
const developmentStylesheets = ["browser-runtime/source-editor/source-editor.css"];
// The list declares the order of CSS layers first, as engine-layout.css does for slides.
const listStylesheets = ["node-tooling/presentation-repository/presentation-list.css", "browser-runtime/visual-theme/default-theme.css"];

// A presentation alone gets "/@slidemachina/entry.js", a presentation of a repository "/@slidemachina/entry/<folder>.js".
export function nameEntryModuleId(siteLayout: SiteLayout, presentationFolder: string): string {
  return `${entryModulePrefix}${toSitePath(siteLayout, presentationFolder)}.js`;
}

function createStylesheetImports(stylesheetPaths: string[]): string {
  return stylesheetPaths.map((stylesheetPath) => `import ${JSON.stringify(stylesheetPath)};`).join("\n");
}

// Engine first, then the repository theme, then the presentation's own style.css: later rules win.
export function createEntryModuleCode(siteLayout: SiteLayout, presentationFolder: string, isDevelopment: boolean): string {
  const sitePath = toSitePath(siteLayout, presentationFolder);
  const ownStylesheet = existsSync(path.join(presentationFolder, "style.css")) ? `${sitePath}/style.css` : undefined;
  const stylesheetPaths = [
    ...[...engineStylesheets, ...(isDevelopment ? developmentStylesheets : [])].map((stylesheetName) => path.join(enginePackageFolder, stylesheetName)),
    siteLayout.themeStylesheet,
    ownStylesheet,
  ].filter((stylesheetPath) => stylesheetPath !== undefined);
  const presentationModuleId = JSON.stringify(`${sitePath}/${presentationFileName}`);
  // A presentation of a repository links back to the list: "../" in dev, "../index.html" in dist/ that also opens from disk.
  const listAddress = JSON.stringify(siteLayout.listAddress ?? (siteLayout.isRepository ? "../" : undefined));
  return `
${createStylesheetImports(stylesheetPaths)}
import { mountPresentation } from ${JSON.stringify(path.join(enginePackageFolder, "browser-runtime", "presentation-core", "presentation-mounting.tsx"))};
import presentationElement from ${presentationModuleId};

mountPresentation(presentationElement, ${listAddress});
if (import.meta.hot) {
  import.meta.hot.accept(${presentationModuleId}, (updatedPresentationModule) => {
    if (updatedPresentationModule) mountPresentation(updatedPresentationModule.default, ${listAddress});
  });
}
`;
}

// The list page is plain HTML: its module brings the styles and the covers that grow into the presentation.
export function createListModuleCode(siteLayout: SiteLayout): string {
  const stylesheetPaths = [...listStylesheets.map((stylesheetName) => path.join(enginePackageFolder, stylesheetName)), siteLayout.themeStylesheet];
  return `${createStylesheetImports(stylesheetPaths.filter((stylesheetPath) => stylesheetPath !== undefined))}
import { connectCoversToPresentations } from ${JSON.stringify(path.join(enginePackageFolder, "browser-runtime", "slide-transitions", "presentation-list-transition.ts"))};
connectCoversToPresentations();
`;
}
