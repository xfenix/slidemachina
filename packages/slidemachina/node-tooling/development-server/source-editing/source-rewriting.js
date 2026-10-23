import MagicString from "magic-string";
import { findLineStarts } from "../../source-transforms/source-marking.js";
import { findAttribute, isPlainTextElement, isStringContainer, parseSlideSource, walkSyntaxTree } from "../../source-transforms/syntax-tree.js";

/** @typedef {import("../../source-transforms/syntax-tree.js").SyntaxNode} SyntaxNode */
/** @typedef {{ lineNumber: number, columnNumber: number }} SourcePlace */
/** @typedef {{ elementNode: SyntaxNode, parentNode: SyntaxNode | undefined }} FoundElement */
/** @typedef {{ columnNumber?: number, anchorPlace?: SourcePlace, anchorSide?: "before" | "after" }} BoxPlacement */

// The code names what went wrong; the page shows it in the presentation's language.
export class SourceEditProblem extends Error {
  /**
   * @param {string} problemCode
   * @param {string} [problemDetail]
   */
  constructor(problemCode, problemDetail = problemCode) {
    super(problemDetail);
    this.problemCode = problemCode;
  }
}

// One parse for every place, so elements found in it can be compared: a moved box and its anchor share a parent.
/**
 * @param {string} sourceCode
 * @param {string} filePath
 * @param {SourcePlace[]} sourcePlaces
 */
function locateElements(sourceCode, filePath, sourcePlaces) {
  const lineStarts = findLineStarts(sourceCode);
  const elementStarts = sourcePlaces.map(({ lineNumber, columnNumber }) => (lineStarts[lineNumber - 1] ?? NaN) + columnNumber - 1);
  const syntaxTree = parseSlideSource(sourceCode, filePath);
  /** @type {(FoundElement | undefined)[]} */
  const foundElements = sourcePlaces.map(() => undefined);
  walkSyntaxTree(syntaxTree, (syntaxNode, ancestorNodes) => {
    if (syntaxNode.type !== "JSXElement") return;
    const placeIndex = elementStarts.indexOf(syntaxNode.start);
    if (placeIndex === -1 || foundElements[placeIndex] !== undefined) return;
    const parentNode = ancestorNodes.findLast((ancestorNode) => ancestorNode.type === "JSXElement" || ancestorNode.type === "JSXFragment");
    foundElements[placeIndex] = { elementNode: syntaxNode, parentNode };
  });
  if (foundElements.includes(undefined)) throw new SourceEditProblem("elementMissing");
  return { syntaxTree, foundElements: /** @type {FoundElement[]} */ (foundElements) };
}

/** @type {Record<string, string>} */
const jsxTextEscapes = { "{": "&#123;", "}": "&#125;", "<": "&lt;", ">": "&gt;" };

/** @param {string} typedText */
function escapeJsxText(typedText) {
  return typedText.replace(/&(?=#?[a-zA-Z0-9]+;)/g, "&amp;").replace(/[{}<>]/g, (escapedCharacter) => jsxTextEscapes[escapedCharacter]);
}

// Whitespace around the text stays as written, so a multi-line element keeps its shape.
/**
 * @param {string} sourceCode
 * @param {string} filePath
 * @param {SourcePlace} sourcePlace
 * @param {string} typedText
 */
export function rewriteElementText(sourceCode, filePath, sourcePlace, typedText) {
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
/**
 * @param {string} sourceCode
 * @param {string} filePath
 * @param {SourcePlace} sourcePlace
 * @param {string} pictureImportPath
 */
export function rewritePictureSource(sourceCode, filePath, sourcePlace, pictureImportPath) {
  const { syntaxTree, foundElements } = locateElements(sourceCode, filePath, [sourcePlace]);
  const pictureValue = findAttribute(foundElements[0].elementNode, "src")?.value;
  let pictureLiteral = pictureValue?.type === "Literal" ? pictureValue : undefined;
  if (pictureValue?.type === "JSXExpressionContainer" && pictureValue.expression.type === "Identifier") {
    const importedName = pictureValue.expression.name;
    const pictureImport = syntaxTree.body.find(
      (/** @type {SyntaxNode} */ statementNode) =>
        statementNode.type === "ImportDeclaration" &&
        statementNode.specifiers.some((/** @type {SyntaxNode} */ specifierNode) => specifierNode.type === "ImportDefaultSpecifier" && specifierNode.local.name === importedName),
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
/**
 * @param {string} sourceCode
 * @param {SyntaxNode} elementNode
 */
function findMovedRange(sourceCode, elementNode) {
  const lineStartOffset = sourceCode.lastIndexOf("\n", elementNode.start - 1) + 1;
  const lineBreak = sourceCode.indexOf("\n", elementNode.end);
  const lineEndOffset = lineBreak === -1 ? sourceCode.length : lineBreak + 1;
  const ownsLines = sourceCode.slice(lineStartOffset, elementNode.start).trim() === "" && sourceCode.slice(elementNode.end, lineEndOffset).trim() === "";
  return ownsLines ? { rangeStart: lineStartOffset, rangeEnd: lineEndOffset } : { rangeStart: elementNode.start, rangeEnd: elementNode.end };
}

/**
 * @param {MagicString} editedSource
 * @param {string} sourceCode
 * @param {SyntaxNode} attributeNode
 */
function removeAttribute(editedSource, sourceCode, attributeNode) {
  let removalStart = attributeNode.start;
  while (removalStart > 0 && /[ \t]/.test(sourceCode[removalStart - 1])) removalStart -= 1;
  editedSource.remove(removalStart, attributeNode.end);
}

/**
 * @param {MagicString} editedSource
 * @param {SyntaxNode} elementNode
 * @param {string} sourceCode
 * @param {number} columnNumber
 */
function pinColumn(editedSource, elementNode, sourceCode, columnNumber) {
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
/**
 * @param {string} sourceCode
 * @param {string} filePath
 * @param {SourcePlace} sourcePlace
 * @param {BoxPlacement} boxPlacement
 */
export function moveDiagramBox(sourceCode, filePath, sourcePlace, boxPlacement) {
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
