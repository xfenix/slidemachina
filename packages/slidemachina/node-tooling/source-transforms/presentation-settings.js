import { readFileSync } from "node:fs";
import path from "node:path";
import { findPresentationFolder, presentationFileName } from "../presentation-repository/presentation-repository.js";
import { findAttribute, findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree } from "./syntax-tree.js";

/** @typedef {import("./syntax-tree.js").SyntaxNode} SyntaxNode */
/** @typedef {{ languageCode: string, usesTypography: boolean, presentationTitle: string | undefined, presentationDate: string | undefined }} PresentationSettings */

/** @type {PresentationSettings} */
const defaultPresentationSettings = { languageCode: "en", usesTypography: true, presentationTitle: undefined, presentationDate: undefined };

// lang and typography={false} live on <Presentation> in index.tsx; slides kept in other files follow them too.
/**
 * @param {SyntaxNode} syntaxTree
 * @returns {PresentationSettings}
 */
function readPresentationSettings(syntaxTree) {
  const presentationName = findEngineNames(syntaxTree).Presentation;
  const presentationSettings = { ...defaultPresentationSettings };
  walkSyntaxTree(syntaxTree, (syntaxNode) => {
    if (syntaxNode.type !== "JSXElement" || readElementName(syntaxNode) !== presentationName) return;
    presentationSettings.languageCode = readStringAttribute(syntaxNode, "lang") ?? "en";
    presentationSettings.presentationTitle = readStringAttribute(syntaxNode, "title");
    presentationSettings.presentationDate = readStringAttribute(syntaxNode, "date");
    const typographyValue = findAttribute(syntaxNode, "typography")?.value;
    presentationSettings.usesTypography = typographyValue?.expression?.value !== false;
  });
  return presentationSettings;
}

/** @param {string} projectFolder */
export function readPresentationFile(projectFolder) {
  const presentationFile = path.join(projectFolder, presentationFileName);
  return readPresentationSettings(parseSlideSource(readFileSync(presentationFile, "utf8"), presentationFile));
}

// Settings come from the index.tsx of the file's own presentation; a shared file outside any presentation gets the defaults.
/**
 * @param {string} filePath
 * @param {SyntaxNode} syntaxTree
 * @param {import("../presentation-repository/presentation-repository.js").SiteLayout} siteLayout
 */
export function readSettingsFor(filePath, syntaxTree, siteLayout) {
  const presentationFolder = findPresentationFolder(siteLayout, filePath);
  if (presentationFolder === undefined) return defaultPresentationSettings;
  const presentationFile = path.join(presentationFolder, presentationFileName);
  return filePath === presentationFile ? readPresentationSettings(syntaxTree) : readPresentationFile(presentationFolder);
}
