// Rules of a talk that is easy to follow, read from index.tsx: Mayer's principles of multimedia learning and Miller's 7±2.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createSyntaxOutlineReader, isSwitchedOn } from "../source-transforms/presentation-settings.ts";
import { findAttribute, findEngineNames, parseSlideSource, readElementName, readStringAttribute, walkSyntaxTree, type SyntaxNode } from "../source-transforms/syntax-tree.ts";
import { outlineSlideMarkup } from "../../shared-between-runtimes/slide-outline-rules.ts";
import { numberSlides } from "../../shared-between-runtimes/slide-numbering.ts";

export type CheckRuleName = "longList" | "wordySlide" | "crowdedDiagram" | "longCode" | "manyColumns" | "manySections" | "missingHeading" | "missingAlt";
export type CheckFinding = {
  ruleName: CheckRuleName;
  slideAddress: string | undefined;
  lineNumber: number;
  columnNumber: number;
  foundCount: number;
  allowedCount: number;
};

export const ruleLimits: Record<CheckRuleName, number> = {
  longList: 7,
  wordySlide: 40,
  crowdedDiagram: 9,
  longCode: 12,
  manyColumns: 3,
  manySections: 7,
  missingHeading: 0,
  missingAlt: 0,
};
// Notes are spoken, code is read as code: neither is the text a listener has to read on the slide.
const unreadElementNames = new Set(["Notes", "Code", "code", "pre", "kbd", "samp"]);
// A thesis, a quote, a meme or a free layout carries the slide without a heading.
const headinglessClassNames = ["machina-thesis", "machina-thesis-small", "machina-freeform-full"];
const headinglessElementNames = new Set(["blockquote", "Meme"]);
const headingElementNames = new Set(["h1", "h2"]);
const listElementNames = new Set(["ul", "ol"]);
const describedPictureNames = new Set(["Image", "Meme", "img"]);
const wordPattern = /[\p{L}\p{N}]+/gu;

// <Machina.Image> and <Image> are the same part.
function readShortName(elementNode: SyntaxNode): string {
  return readElementName(elementNode)?.split(".").at(-1) ?? "";
}

function readClassNames(elementNode: SyntaxNode): string[] {
  return (readStringAttribute(elementNode, "className") ?? "").split(/\s+/);
}

function listElementChildren(elementNode: SyntaxNode): SyntaxNode[] {
  return elementNode.children.filter((childNode: SyntaxNode) => childNode.type === "JSXElement");
}

// Visits the elements of a slide, skipping what the listener does not read: notes and code.
function walkReadElements(slideNode: SyntaxNode, visitElement: (elementNode: SyntaxNode) => void) {
  const visitChildren = (parentNode: SyntaxNode) => {
    for (const childNode of parentNode.children ?? []) {
      if (childNode.type !== "JSXElement" && childNode.type !== "JSXFragment") continue;
      if (childNode.type === "JSXElement" && unreadElementNames.has(readShortName(childNode))) continue;
      if (childNode.type === "JSXElement") visitElement(childNode);
      visitChildren(childNode);
    }
  };
  visitChildren(slideNode);
}

function countReadWords(slideNode: SyntaxNode): number {
  let wordCount = 0;
  const countText = (textValue: string) => (wordCount += textValue.match(wordPattern)?.length ?? 0);
  const visitText = (parentNode: SyntaxNode) => {
    for (const childNode of parentNode.children ?? []) {
      if (childNode.type === "JSXText") countText(childNode.value);
      else if (childNode.type === "JSXExpressionContainer" && typeof childNode.expression.value === "string") countText(childNode.expression.value);
      else if (childNode.type === "JSXFragment") visitText(childNode);
      else if (childNode.type === "JSXElement" && !unreadElementNames.has(readShortName(childNode))) visitText(childNode);
    }
  };
  visitText(slideNode);
  return wordCount;
}

// Inline code counts its lines; a file named in src is read, so long code from a file is caught too.
function countCodeLines(codeNode: SyntaxNode, presentationFolder: string): number {
  const codeSource = readStringAttribute(codeNode, "src");
  if (codeSource !== undefined) {
    const codeFile = path.join(presentationFolder, codeSource);
    return existsSync(codeFile) ? readFileSync(codeFile, "utf8").trimEnd().split("\n").length : 0;
  }
  let inlineCode = "";
  walkSyntaxTree(codeNode.children, (syntaxNode) => {
    if (syntaxNode.type === "TemplateElement") inlineCode += syntaxNode.value.cooked ?? "";
    if (syntaxNode.type === "Literal" && typeof syntaxNode.value === "string") inlineCode += syntaxNode.value;
  });
  return inlineCode.trim() === "" ? 0 : inlineCode.trim().split("\n").length;
}

function measureLinePositions(sourceCode: string): number[] {
  const lineStarts = [0];
  for (let characterIndex = 0; characterIndex < sourceCode.length; characterIndex += 1) {
    if (sourceCode[characterIndex] === "\n") lineStarts.push(characterIndex + 1);
  }
  return lineStarts;
}

export function checkPresentationSource(sourceCode: string, presentationFile: string): CheckFinding[] {
  const syntaxTree = parseSlideSource(sourceCode, presentationFile);
  const engineNames = findEngineNames(syntaxTree);
  const outlineReader = createSyntaxOutlineReader(engineNames);
  const lineStarts = measureLinePositions(sourceCode);
  const presentationFolder = path.dirname(presentationFile);
  const findings: CheckFinding[] = [];
  const reportFinding = (ruleName: CheckRuleName, syntaxNode: SyntaxNode, slideAddress: string | undefined, foundCount: number) => {
    const lineIndex = lineStarts.findLastIndex((lineStart) => lineStart <= syntaxNode.start);
    findings.push({ ruleName, slideAddress, lineNumber: lineIndex + 1, columnNumber: syntaxNode.start - lineStarts[lineIndex]! + 1, foundCount, allowedCount: ruleLimits[ruleName] });
  };
  let presentationNode: SyntaxNode | undefined;
  walkSyntaxTree(syntaxTree, (syntaxNode) => {
    if (presentationNode === undefined && syntaxNode.type === "JSXElement" && readElementName(syntaxNode) === engineNames.Presentation) presentationNode = syntaxNode;
  });
  if (presentationNode === undefined) return findings;

  const topLevelSections = outlineReader.listMarkupChildren(presentationNode).flatMap(function collectSections(markupNode: SyntaxNode): SyntaxNode[] {
    const markupKind = outlineReader.classifyMarkupNode(markupNode);
    if (markupKind === "fragment") return outlineReader.listMarkupChildren(markupNode).flatMap(collectSections);
    return markupKind === "section" ? [markupNode] : [];
  });
  if (topLevelSections.length > ruleLimits.manySections) reportFinding("manySections", topLevelSections[ruleLimits.manySections]!, undefined, topLevelSections.length);

  const outlinedSlides = outlineSlideMarkup(outlineReader.listMarkupChildren(presentationNode), outlineReader);
  const hiddenFlags = outlinedSlides.map(({ slideNode, isGeneratedCover }) => !isGeneratedCover && isSwitchedOn(findAttribute(slideNode, "hidden")));
  const { slideAddresses } = numberSlides(hiddenFlags);
  outlinedSlides.forEach(({ slideNode, isGeneratedCover }, slideIndex) => {
    if (isGeneratedCover) return;
    const slideAddress = slideAddresses[slideIndex];
    // A hidden slide is read later, not on stage: it may hold the long text a shown slide may not.
    const isReadLater = hiddenFlags[slideIndex] === true;
    const readElements: SyntaxNode[] = [];
    walkReadElements(slideNode, (elementNode) => readElements.push(elementNode));
    const hasHeading = readElements.some((elementNode) => headingElementNames.has(readShortName(elementNode)));
    const carriesWithoutHeading = readElements.some(
      (elementNode) => headinglessElementNames.has(readShortName(elementNode)) || readClassNames(elementNode).some((className) => headinglessClassNames.includes(className)),
    );
    for (const elementNode of readElements) {
      const elementName = readShortName(elementNode);
      if (listElementNames.has(elementName)) {
        const itemCount = listElementChildren(elementNode).filter((childNode) => readElementName(childNode) === "li").length;
        if (itemCount > ruleLimits.longList && !isReadLater) reportFinding("longList", elementNode, slideAddress, itemCount);
      }
      if (readClassNames(elementNode).includes("machina-columns")) {
        const columnCount = listElementChildren(elementNode).length;
        if (columnCount > ruleLimits.manyColumns) reportFinding("manyColumns", elementNode, slideAddress, columnCount);
      }
      if (elementName === "Diagram" || elementName === "Sequence") {
        const partNames: string[] = [];
        walkSyntaxTree(elementNode.children, (partNode) => {
          if (partNode.type === "JSXElement") partNames.push(readShortName(partNode));
        });
        const partCount = partNames.filter((partName) => partName === "Box" || partName === "Message").length;
        if (partCount > ruleLimits.crowdedDiagram && !partNames.includes("Focus")) reportFinding("crowdedDiagram", elementNode, slideAddress, partCount);
      }
      if (describedPictureNames.has(elementName) && findAttribute(elementNode, "alt") === undefined) reportFinding("missingAlt", elementNode, slideAddress, 0);
    }
    walkSyntaxTree(slideNode.children, (syntaxNode) => {
      if (syntaxNode.type !== "JSXElement" || readShortName(syntaxNode) !== "Code" || findAttribute(syntaxNode, "lines") !== undefined) return;
      const codeLineCount = countCodeLines(syntaxNode, presentationFolder);
      if (codeLineCount > ruleLimits.longCode) reportFinding("longCode", syntaxNode, slideAddress, codeLineCount);
    });
    if (!hasHeading && !carriesWithoutHeading) reportFinding("missingHeading", slideNode, slideAddress, 0);
    const wordCount = countReadWords(slideNode);
    if (wordCount > ruleLimits.wordySlide && !isReadLater) reportFinding("wordySlide", slideNode, slideAddress, wordCount);
  });
  return findings.sort((firstFinding, secondFinding) => firstFinding.lineNumber - secondFinding.lineNumber || firstFinding.columnNumber - secondFinding.columnNumber);
}
