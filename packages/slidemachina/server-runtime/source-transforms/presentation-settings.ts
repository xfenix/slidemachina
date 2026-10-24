import { readFileSync } from "node:fs";
import path from "node:path";
import { findPresentationFolder, presentationFileName } from "../presentation-repository/presentation-repository.ts";
import { findAttribute, findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export type PresentationSettings = { languageCode: string, usesTypography: boolean, presentationTitle: string | undefined, presentationDate: string | undefined };

const defaultPresentationSettings: PresentationSettings = { languageCode: "en", usesTypography: true, presentationTitle: undefined, presentationDate: undefined };

// lang and typography={false} live on <Presentation> in index.tsx; slides kept in other files follow them too.
function readPresentationSettings(syntaxTree: SyntaxNode): PresentationSettings {
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

export function readPresentationFile(projectFolder: string): PresentationSettings {
  const presentationFile = path.join(projectFolder, presentationFileName);
  return readPresentationSettings(parseSlideSource(readFileSync(presentationFile, "utf8"), presentationFile));
}

// Settings come from the index.tsx of the file's own presentation; a shared file outside any presentation gets the defaults.
export function readSettingsFor(filePath: string, syntaxTree: SyntaxNode, siteLayout: SiteLayout): PresentationSettings {
  const presentationFolder = findPresentationFolder(siteLayout, filePath);
  if (presentationFolder === undefined) return defaultPresentationSettings;
  const presentationFile = path.join(presentationFolder, presentationFileName);
  return filePath === presentationFile ? readPresentationSettings(syntaxTree) : readPresentationFile(presentationFolder);
}
