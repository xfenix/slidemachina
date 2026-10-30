import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { enginePackageFolder, presentationMountingId } from "./engine-resolution.ts";
import { presentationFileName, toSitePath } from "../presentation-repository/presentation-repository.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export const entryModulePrefix = "/@slidemachina/entry";
export const listModuleId = "/@slidemachina/presentation-list.js";
const engineRuntimeFolder = "browser-runtime";
// engine-layout.css declares the order of CSS layers, the default theme comes before the blocks that refine it.
const leadingStylesheets = ["browser-runtime/visual-theme/engine-layout.css", "browser-runtime/visual-theme/default-theme.css"];
// The editor and the meme panel exist only in slidemachina dev, so a build leaves their styles out.
const developmentStylesheets = ["browser-runtime/source-editor/source-editor.css", "browser-runtime/source-editor/meme-panel.css"];
const memeFontStylesheetName = "browser-runtime/content-blocks/meme-block/meme-font.css";
// The slide source plugin imports it into files with <Meme>: other presentations do not carry the caption font.
export const memeFontStylesheet = path.join(enginePackageFolder, memeFontStylesheetName);
// The list declares the order of CSS layers first, as engine-layout.css does for slides.
const listStylesheets = ["server-runtime/presentation-repository/presentation-list.css", "browser-runtime/visual-theme/default-theme.css"];

// Every stylesheet of the runtime: a folder's own styles come before the styles of its nested components.
const engineStylesheets = listEngineStylesheets();

function listEngineStylesheets(): string[] {
  const skippedStylesheets = new Set([...leadingStylesheets, ...developmentStylesheets, memeFontStylesheetName]);
  const foundStylesheets = readdirSync(path.join(enginePackageFolder, engineRuntimeFolder), { recursive: true, encoding: "utf8" })
    .filter((relativePath) => relativePath.endsWith(".css"))
    .map((relativePath) => path.posix.join(engineRuntimeFolder, relativePath.split(path.sep).join(path.posix.sep)))
    .filter((stylesheetPath) => !skippedStylesheets.has(stylesheetPath))
    .sort(compareStylesheetPaths);
  return [...leadingStylesheets, ...foundStylesheets];
}

function compareStylesheetPaths(firstPath: string, secondPath: string): number {
  const depthDifference = firstPath.split("/").length - secondPath.split("/").length;
  return depthDifference !== 0 ? depthDifference : firstPath.localeCompare(secondPath);
}

// A presentation alone gets "/@slidemachina/entry.js", a presentation of a repository "/@slidemachina/entry/<folder>.js".
export function nameEntryModuleId(siteLayout: SiteLayout, presentationFolder: string): string {
  return `${entryModulePrefix}${toSitePath(siteLayout, presentationFolder)}.js`;
}

function createStylesheetImports(stylesheetPaths: string[]): string {
  return stylesheetPaths.map((stylesheetPath) => `import ${JSON.stringify(stylesheetPath)};`).join("\n");
}

// Engine, the repository theme, the CSS that index.tsx imports, then the presentation's own style.css: later rules win.
export function createEntryModuleCode(siteLayout: SiteLayout, presentationFolder: string, isDevelopment: boolean): string {
  const sitePath = toSitePath(siteLayout, presentationFolder);
  const ownStylesheet = existsSync(path.join(presentationFolder, "style.css")) ? `${sitePath}/style.css` : undefined;
  const stylesheetPaths = [
    ...[...engineStylesheets, ...(isDevelopment ? developmentStylesheets : [])].map((stylesheetName) => path.join(enginePackageFolder, stylesheetName)),
    siteLayout.themeStylesheet,
  ].filter((stylesheetPath) => stylesheetPath !== undefined);
  const presentationModuleId = JSON.stringify(`${sitePath}/${presentationFileName}`);
  // A presentation of a repository links back to the list: "../" in dev, "../index.html" in dist/ that also opens from disk.
  const listAddress = JSON.stringify(siteLayout.listAddress ?? (siteLayout.isRepository ? "../" : undefined));
  return `
${createStylesheetImports(stylesheetPaths)}
import { mountPresentation } from ${JSON.stringify(presentationMountingId)};
import presentationElement from ${presentationModuleId};
${createStylesheetImports(ownStylesheet === undefined ? [] : [ownStylesheet])}

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
