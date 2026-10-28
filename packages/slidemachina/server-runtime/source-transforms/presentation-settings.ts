import { readFileSync } from "node:fs";
import path from "node:path";
import { findPresentationFolder, presentationFileName } from "../presentation-repository/presentation-repository.ts";
import { findAttribute, findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree } from "./syntax-tree.ts";
import { findOpeningCover, type SlideOutlineReader } from "../../shared-between-runtimes/slide-outline-rules.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type { SiteLayout } from "../presentation-repository/presentation-repository.ts";

export type PresentationSettings = {
  languageCode: string,
  usesTypography: boolean,
  presentationTitle: string | undefined,
  presentationDate: string | undefined,
  aspectRatio: string | undefined,
};

const defaultPresentationSettings: PresentationSettings = {
  languageCode: "en",
  usesTypography: true,
  presentationTitle: undefined,
  presentationDate: undefined,
  aspectRatio: undefined,
};

const fragmentNames = new Set(["Fragment", "React.Fragment"]);

function isSwitchedOn(attributeNode: SyntaxNode | undefined): boolean {
  return attributeNode !== undefined && (attributeNode.value === null || attributeNode.value?.expression?.value === true);
}

function createSyntaxOutlineReader(engineNames: Record<string, string>): SlideOutlineReader<SyntaxNode> {
  return {
    classifyMarkupNode: (markupNode) => {
      if (markupNode.type === "JSXFragment" || fragmentNames.has(readElementName(markupNode) ?? "")) return "fragment";
      return readElementName(markupNode) === engineNames.Section ? "section" : "slide";
    },
    listMarkupChildren: (markupNode) => markupNode.children.filter((childNode: SyntaxNode) => childNode.type === "JSXElement" || childNode.type === "JSXFragment"),
    dropsSectionCover: (sectionNode) => findAttribute(sectionNode, "cover")?.value?.expression?.value === false,
    isCoverSlide: (slideNode) => readElementName(slideNode) === engineNames.Slide && isSwitchedOn(findAttribute(slideNode, "cover")),
  };
}

// Text inside nested tags counts too; a line break stays a space.
function collectElementText(elementNode: SyntaxNode): string {
  return elementNode.children
    .map((childNode: SyntaxNode) => {
      if (childNode.type === "JSXText") return childNode.value;
      if (childNode.type === "JSXExpressionContainer" && typeof childNode.expression.value === "string") return childNode.expression.value;
      if (childNode.type === "JSXFragment") return collectElementText(childNode);
      if (childNode.type !== "JSXElement") return "";
      return readElementName(childNode) === "br" ? " " : collectElementText(childNode);
    })
    .join("");
}

function readCoverTitle(coverNode: SyntaxNode | undefined): string | undefined {
  let coverTitle: string | undefined;
  walkSyntaxTree(coverNode?.children, (syntaxNode) => {
    if (coverTitle === undefined && syntaxNode.type === "JSXElement" && readElementName(syntaxNode) === "h1") {
      coverTitle = collectElementText(syntaxNode).replace(/\s+/g, " ").trim();
    }
  });
  return coverTitle;
}

// lang and typography={false} live on <Presentation> in index.tsx; slides kept in other files follow them too.
// The list and the password page name the talk by title, or by the h1 of its opening <Slide cover>, as the page does.
function readPresentationSettings(syntaxTree: SyntaxNode): PresentationSettings {
  const engineNames = findEngineNames(syntaxTree);
  const presentationName = engineNames.Presentation;
  const outlineReader = createSyntaxOutlineReader(engineNames);
  const presentationSettings = { ...defaultPresentationSettings };
  walkSyntaxTree(syntaxTree, (syntaxNode) => {
    if (syntaxNode.type !== "JSXElement" || readElementName(syntaxNode) !== presentationName) return;
    presentationSettings.languageCode = readStringAttribute(syntaxNode, "lang") ?? "en";
    presentationSettings.presentationTitle =
      readStringAttribute(syntaxNode, "title") ?? readCoverTitle(findOpeningCover(outlineReader.listMarkupChildren(syntaxNode), outlineReader));
    presentationSettings.presentationDate = readStringAttribute(syntaxNode, "date");
    presentationSettings.aspectRatio = readStringAttribute(syntaxNode, "aspectRatio");
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
