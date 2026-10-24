import MagicString from "magic-string";
import { findLineStarts } from "../../source-transforms/source-marking.ts";
import { findAttribute, isPlainTextElement, isStringContainer, parseSlideSource, walkSyntaxTree } from "../../source-transforms/syntax-tree.ts";
import type { SyntaxNode } from "../../source-transforms/syntax-tree.ts";

export type SourcePlace = { lineNumber: number, columnNumber: number };
type FoundElement = { elementNode: SyntaxNode, parentNode: SyntaxNode | undefined };
type BoxPlacement = { columnNumber?: number, anchorPlace?: SourcePlace, anchorSide?: "before" | "after" };

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

function escapeJsxText(typedText: string): string {
  return typedText.replace(/&(?=#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/[{}<>]/g, (escapedCharacter) => jsxTextEscapes[escapedCharacter]);
}

// Whitespace around the text stays as written, so a multi-line element keeps its shape.
export function rewriteElementText(sourceCode: string, filePath: string, sourcePlace: SourcePlace, typedText: string): string {
  const { elementNode } = locateElements(sourceCode, filePath, [sourcePlace]).foundElements[0];
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
  const pictureValue = findAttribute(foundElements[0].elementNode, "src")?.value;
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
  while (removalStart > 0 && /[ \t]/.test(sourceCode[removalStart - 1])) removalStart -= 1;
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
  const [boxElement, anchorElement] = locateElements(sourceCode, filePath, sourcePlaces).foundElements;
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
