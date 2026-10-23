import { existsSync } from "node:fs";
import path from "node:path";
import { engineFolder } from "./engine-resolution.js";
import { presentationFileName, toSitePath } from "./presentation-repository.js";

export const entryModulePrefix = "/@slidemachina/entry";
export const listModuleId = "/@slidemachina/presentation-list.js";
const engineStylesheets = [
  "engine-layout.css",
  "slide-navigator.css",
  "presentation-toolbar.css",
  "print-menu.css",
  "print-layout.css",
  "slide-transitions.css",
  "default-theme.css",
  "content-blocks.css",
  "code-block.css",
  "diagram-blocks.css",
  "sequence-blocks.css",
  "scene-block.css",
];
// The editor exists only in slidemachina dev, so a build leaves its styles out.
const developmentStylesheets = ["source-editor.css"];
// The list declares the order of CSS layers first, as engine-layout.css does for slides.
const listStylesheets = ["presentation-list.css", "default-theme.css"];

// A presentation alone gets "/@slidemachina/entry.js", a presentation of a repository "/@slidemachina/entry/<folder>.js".
/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {string} presentationFolder
 */
export function entryModuleIdFor(siteLayout, presentationFolder) {
  return `${entryModulePrefix}${toSitePath(siteLayout, presentationFolder)}.js`;
}

/** @param {string[]} stylesheetPaths */
function createStylesheetImports(stylesheetPaths) {
  return stylesheetPaths.map((stylesheetPath) => `import ${JSON.stringify(stylesheetPath)};`).join("\n");
}

// Engine first, then the repository theme, then the presentation's own style.css: later rules win.
/**
 * @param {import("./presentation-repository.js").SiteLayout} siteLayout
 * @param {string} presentationFolder
 * @param {boolean} isDevelopment
 */
export function createEntryModuleCode(siteLayout, presentationFolder, isDevelopment) {
  const sitePath = toSitePath(siteLayout, presentationFolder);
  const ownStylesheet = existsSync(path.join(presentationFolder, "style.css")) ? `${sitePath}/style.css` : undefined;
  const stylesheetPaths = [
    ...[...engineStylesheets, ...(isDevelopment ? developmentStylesheets : [])].map((stylesheetName) => path.join(engineFolder, stylesheetName)),
    siteLayout.themeStylesheet,
    ownStylesheet,
  ].filter((stylesheetPath) => stylesheetPath !== undefined);
  const presentationModuleId = JSON.stringify(`${sitePath}/${presentationFileName}`);
  // A presentation of a repository links back to the list: "../" in dev, "../index.html" in dist/ that also opens from disk.
  const listAddress = JSON.stringify(siteLayout.listAddress ?? (siteLayout.isRepository ? "../" : undefined));
  return `
${createStylesheetImports(stylesheetPaths)}
import { mountPresentation } from ${JSON.stringify(path.join(engineFolder, "mount-presentation.tsx"))};
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
/** @param {import("./presentation-repository.js").SiteLayout} siteLayout */
export function createListModuleCode(siteLayout) {
  const stylesheetPaths = [...listStylesheets.map((stylesheetName) => path.join(engineFolder, stylesheetName)), siteLayout.themeStylesheet];
  return `${createStylesheetImports(stylesheetPaths.filter((stylesheetPath) => stylesheetPath !== undefined))}
import { connectCoversToPresentations } from ${JSON.stringify(path.join(engineFolder, "list-transition.ts"))};
connectCoversToPresentations();
`;
}
