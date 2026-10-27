import MagicString from "magic-string";
import { findLineStarts } from "../source-transforms/source-marking.ts";
import { findAttribute, findEngineNames, isPlainTextElement, isStringContainer, parseSlideSource, walkSyntaxTree } from "../source-transforms/syntax-tree.ts";
import type { SyntaxNode } from "../source-transforms/syntax-tree.ts";

export type SourcePlace = { lineNumber: number, columnNumber: number };
type FoundElement = { elementNode: SyntaxNode, parentNode: SyntaxNode | undefined };
type BoxPlacement = { columnNumber?: number, anchorPlace?: SourcePlace, anchorSide?: "before" | "after" };
export type SlideAction = "add" | "duplicate" | "earlier" | "later" | "remove";
export type InsertedSlide = {
  engineParts: string[],
  mediaImport: { importName: string, importPath: string } | undefined,
  writeMarkup: (nameEnginePart: (partName: string) => string) => string[],
};

const jsxTextEscapes: Record<string, string> = { "{": "&#123;", "}": "&#125;", "<": "&lt;", ">": "&gt;" };

// The code names what went wrong; the page shows it in the presentation's language.
export class SourceEditProblem extends Error {
  problemCode: string;

  constructor(problemCode: string, problemDetail: string = problemCode) {
    super(problemDetail);
    this.problemCode = problemCode;
  }
}

// One parse for every place, so elements found in it can be compared: a moved box and its anchor share a parent.
function locateElements(sourceCode: string, filePath: string, sourcePlaces: SourcePlace[]): { syntaxTree: SyntaxNode, foundElements: FoundElement[] } {
  const lineStarts = findLineStarts(sourceCode);
  const elementStarts = sourcePlaces.map(({ lineNumber, columnNumber }) => (lineStarts[lineNumber - 1] ?? NaN) + columnNumber - 1);
  const syntaxTree = parseSlideSource(sourceCode, filePath);
  const foundElements: (FoundElement | undefined)[] = sourcePlaces.map(() => undefined);
  walkSyntaxTree(syntaxTree, (syntaxNode, ancestorNodes) => {
    if (syntaxNode.type !== "JSXElement") return;
    const placeIndex = elementStarts.indexOf(syntaxNode.start);
    if (placeIndex === -1 || foundElements[placeIndex] !== undefined) return;
    const parentNode = ancestorNodes.findLast((ancestorNode) => ancestorNode.type === "JSXElement" || ancestorNode.type === "JSXFragment");
    foundElements[placeIndex] = { elementNode: syntaxNode, parentNode };
  });
  if (foundElements.includes(undefined)) throw new SourceEditProblem("elementMissing");
  return { syntaxTree, foundElements: foundElements as FoundElement[] };
}

export function escapeJsxText(typedText: string): string {
  return typedText.replace(/&(?=#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/[{}<>]/g, (escapedCharacter) => jsxTextEscapes[escapedCharacter]!);
}

// Whitespace around the text stays as written, so a multi-line element keeps its shape.
export function rewriteElementText(sourceCode: string, filePath: string, sourcePlace: SourcePlace, typedText: string): string {
  const { elementNode } = locateElements(sourceCode, filePath, [sourcePlace]).foundElements[0]!;
  if (!isPlainTextElement(elementNode)) throw new SourceEditProblem("textHasMarkup");
  const firstChild = elementNode.children[0];
  const lastChild = elementNode.children.at(-1);
  const childrenSource = sourceCode.slice(firstChild.start, lastChild.end);
  const leadingSpace = firstChild.type === "JSXText" ? childrenSource.match(/^\s*/)?.[0] ?? "" : "";
  const trailingSpace = lastChild.type === "JSXText" ? childrenSource.match(/\s*$/)?.[0] ?? "" : "";
  const writesLiteral = elementNode.children.some(isStringContainer);
  const writtenText = writesLiteral ? `{${JSON.stringify(typedText)}}` : escapeJsxText(typedText);
  const editedSource = new MagicString(sourceCode);
  editedSource.overwrite(firstChild.start + leadingSpace.length, lastChild.end - trailingSpace.length, writtenText);
  return editedSource.toString();
}

// src={picture} changes the import of picture, so every slide showing it gets the new file; src="…" changes in place.
export function rewritePictureSource(sourceCode: string, filePath: string, sourcePlace: SourcePlace, pictureImportPath: string): string {
  const { syntaxTree, foundElements } = locateElements(sourceCode, filePath, [sourcePlace]);
  const pictureValue = findAttribute(foundElements[0]!.elementNode, "src")?.value;
  let pictureLiteral = pictureValue?.type === "Literal" ? pictureValue : undefined;
  if (pictureValue?.type === "JSXExpressionContainer" && pictureValue.expression.type === "Identifier") {
    const importedName = pictureValue.expression.name;
    const pictureImport = syntaxTree.body.find(
      (statementNode: SyntaxNode) =>
        statementNode.type === "ImportDeclaration" &&
        statementNode.specifiers.some((specifierNode: SyntaxNode) => specifierNode.type === "ImportDefaultSpecifier" && specifierNode.local.name === importedName),
    );
    pictureLiteral = pictureImport?.source;
  }
  if (pictureLiteral === undefined) throw new SourceEditProblem("pictureExpression");
  const quoteMark = sourceCode[pictureLiteral.start];
  const editedSource = new MagicString(sourceCode);
  editedSource.overwrite(pictureLiteral.start, pictureLiteral.end, `${quoteMark}${pictureImportPath}${quoteMark}`);
  return editedSource.toString();
}

// An element alone on its lines moves with its lines; otherwise only the element itself moves.
function findMovedRange(sourceCode: string, elementNode: SyntaxNode): { rangeStart: number, rangeEnd: number } {
  const lineStartOffset = sourceCode.lastIndexOf("\n", elementNode.start - 1) + 1;
  const lineBreak = sourceCode.indexOf("\n", elementNode.end);
  const lineEndOffset = lineBreak === -1 ? sourceCode.length : lineBreak + 1;
  const ownsLines = sourceCode.slice(lineStartOffset, elementNode.start).trim() === "" && sourceCode.slice(elementNode.end, lineEndOffset).trim() === "";
  return ownsLines ? { rangeStart: lineStartOffset, rangeEnd: lineEndOffset } : { rangeStart: elementNode.start, rangeEnd: elementNode.end };
}

function removeAttribute(editedSource: MagicString, sourceCode: string, attributeNode: SyntaxNode): void {
  let removalStart = attributeNode.start;
  while (removalStart > 0 && /[ \t]/.test(sourceCode.charAt(removalStart - 1))) removalStart -= 1;
  editedSource.remove(removalStart, attributeNode.end);
}

function pinColumn(editedSource: MagicString, elementNode: SyntaxNode, sourceCode: string, columnNumber: number): void {
  for (const pinAttributeName of ["first", "last"]) {
    const pinAttribute = findAttribute(elementNode, pinAttributeName);
    if (pinAttribute !== undefined) removeAttribute(editedSource, sourceCode, pinAttribute);
  }
  const columnAttribute = findAttribute(elementNode, "column");
  const writtenColumn = `column={${columnNumber}}`;
  if (columnAttribute !== undefined) {
    editedSource.overwrite(columnAttribute.start, columnAttribute.end, writtenColumn);
    return;
  }
  const precedingNode = findAttribute(elementNode, "id") ?? elementNode.openingElement.name;
  editedSource.appendLeft(precedingNode.end, ` ${writtenColumn}`);
}

// The anchor is a sibling of the box: it never leaves its level.
export function moveDiagramBox(sourceCode: string, filePath: string, sourcePlace: SourcePlace, boxPlacement: BoxPlacement): string {
  const { anchorPlace, anchorSide, columnNumber } = boxPlacement;
  const sourcePlaces = anchorPlace === undefined ? [sourcePlace] : [sourcePlace, anchorPlace];
  const [boxElement, anchorElement] = locateElements(sourceCode, filePath, sourcePlaces).foundElements as [FoundElement, FoundElement?];
  if (anchorElement !== undefined && anchorElement.parentNode !== boxElement.parentNode) throw new SourceEditProblem("boxOutsideLevel");
  const editedSource = new MagicString(sourceCode);
  if (columnNumber !== undefined) pinColumn(editedSource, boxElement.elementNode, sourceCode, columnNumber);
  if (anchorElement !== undefined) {
    const { rangeStart, rangeEnd } = findMovedRange(sourceCode, boxElement.elementNode);
    const anchorRange = rangeEnd - rangeStart > boxElement.elementNode.end - boxElement.elementNode.start
      ? findMovedRange(sourceCode, anchorElement.elementNode)
      : { rangeStart: anchorElement.elementNode.start, rangeEnd: anchorElement.elementNode.end };
    const targetOffset = anchorSide === "after" ? anchorRange.rangeEnd : anchorRange.rangeStart;
    if (targetOffset < rangeStart || targetOffset > rangeEnd) editedSource.move(rangeStart, rangeEnd, targetOffset);
  }
  return editedSource.toString();
}

function readIndent(sourceCode: string, elementStart: number): string {
  const lineStart = sourceCode.lastIndexOf("\n", elementStart - 1) + 1;
  const leadingText = sourceCode.slice(lineStart, elementStart);
  return leadingText.trim() === "" ? leadingText : "";
}

// Parts missing from a named import of "slidemachina" are added to it; a namespace import already has them all.
function ensureEngineParts(syntaxTree: SyntaxNode, editedSource: MagicString, partNames: string[]): (partName: string) => string {
  const engineNames = findEngineNames(syntaxTree);
  const missingParts = partNames.filter((partName) => engineNames[partName] === undefined);
  if (missingParts.length > 0) {
    const engineImport = syntaxTree.body.find(
      (statementNode: SyntaxNode) => statementNode.type === "ImportDeclaration" && statementNode.source.value === "slidemachina" && statementNode.specifiers.length > 0,
    );
    if (engineImport === undefined) editedSource.prepend(`import { ${missingParts.join(", ")} } from "slidemachina";\n`);
    else editedSource.appendLeft(engineImport.specifiers.at(-1).end, `, ${missingParts.join(", ")}`);
  }
  return (partName) => engineNames[partName] ?? partName;
}

// The new slide follows the shown one; after a section's own slide (cover={<Slide>}) it opens the section.
export function insertSlideAfter(sourceCode: string, filePath: string, slidePlace: SourcePlace, insertedSlide: InsertedSlide): string {
  const { syntaxTree, foundElements } = locateElements(sourceCode, filePath, [slidePlace]);
  const { elementNode: slideNode, parentNode } = foundElements[0]!;
  const editedSource = new MagicString(sourceCode);
  const isChildSlide = parentNode?.children?.includes(slideNode) === true;
  const isSectionCover = !isChildSlide && parentNode?.type === "JSXElement" && slideNode.start < parentNode.openingElement.end;
  if (!isChildSlide && !isSectionCover) throw new SourceEditProblem("slidePlaceUnknown");
  const nameEnginePart = ensureEngineParts(syntaxTree, editedSource, ["Slide", ...insertedSlide.engineParts]);
  const { mediaImport } = insertedSlide;
  if (mediaImport !== undefined) {
    const lastImport = syntaxTree.body.findLast((statementNode: SyntaxNode) => statementNode.type === "ImportDeclaration");
    const importStatement = `import ${mediaImport.importName} from ${JSON.stringify(mediaImport.importPath)};`;
    if (lastImport === undefined) editedSource.prepend(`${importStatement}\n`);
    else editedSource.appendLeft(lastImport.end, `\n${importStatement}`);
  }
  const slideName = nameEnginePart("Slide");
  const slideLines = [`<${slideName}>`, ...insertedSlide.writeMarkup(nameEnginePart).map((markupLine) => `  ${markupLine}`), `</${slideName}>`];
  if (isChildSlide) {
    const slideIndent = readIndent(sourceCode, slideNode.start);
    editedSource.appendLeft(slideNode.end, `\n${slideLines.map((slideLine) => `\n${slideIndent}${slideLine}`).join("")}`);
  } else {
    const slideIndent = `${readIndent(sourceCode, parentNode.start)}  `;
    editedSource.appendLeft(parentNode.openingElement.end, `${slideLines.map((slideLine) => `\n${slideIndent}${slideLine}`).join("")}\n`);
  }
  return editedSource.toString();
}

// Neighbours at the same level: a slide steps over a whole section, it does not enter it.
function findSiblingElements(parentNode: SyntaxNode | undefined): SyntaxNode[] {
  return (parentNode?.children ?? []).filter((childNode: SyntaxNode) => childNode.type === "JSXElement");
}

// A slide trades places with its neighbour as text: both keep the indent of their level. Returns the source and the new start of the slide.
export function moveSlide(sourceCode: string, filePath: string, slidePlace: SourcePlace, movesEarlier: boolean): { editedCode: string, slideStart: number } {
  const { elementNode: slideNode, parentNode } = locateElements(sourceCode, filePath, [slidePlace]).foundElements[0]!;
  const siblingElements = findSiblingElements(parentNode);
  const slidePosition = siblingElements.indexOf(slideNode);
  if (slidePosition === -1) throw new SourceEditProblem("slidePlaceUnknown");
  const neighbourNode = siblingElements[slidePosition + (movesEarlier ? -1 : 1)];
  if (neighbourNode === undefined) throw new SourceEditProblem("slideAtEdge");
  const [firstNode, secondNode] = movesEarlier ? [neighbourNode, slideNode] : [slideNode, neighbourNode];
  const editedSource = new MagicString(sourceCode);
  editedSource.overwrite(firstNode.start, firstNode.end, sourceCode.slice(secondNode.start, secondNode.end));
  editedSource.overwrite(secondNode.start, secondNode.end, sourceCode.slice(firstNode.start, firstNode.end));
  const slideStart = movesEarlier ? neighbourNode.start : neighbourNode.end - (slideNode.end - slideNode.start);
  return { editedCode: editedSource.toString(), slideStart };
}

// A copy goes right after the slide, a removed slide takes its own lines and one blank line after them.
export function copyOrRemoveSlide(sourceCode: string, filePath: string, slidePlace: SourcePlace, removesSlide: boolean): string {
  const { elementNode: slideNode, parentNode } = locateElements(sourceCode, filePath, [slidePlace]).foundElements[0]!;
  if (!findSiblingElements(parentNode).includes(slideNode)) throw new SourceEditProblem("slidePlaceUnknown");
  const editedSource = new MagicString(sourceCode);
  const { rangeStart, rangeEnd } = findMovedRange(sourceCode, slideNode);
  if (!removesSlide) {
    const slideIndent = readIndent(sourceCode, slideNode.start);
    editedSource.appendLeft(slideNode.end, `\n\n${slideIndent}${sourceCode.slice(slideNode.start, slideNode.end)}`);
    return editedSource.toString();
  }
  const followingBlank = /^[ \t]*\n/.exec(sourceCode.slice(rangeEnd))?.[0] ?? "";
  editedSource.remove(rangeStart, rangeEnd + followingBlank.length);
  return editedSource.toString();
}
