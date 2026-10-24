import { createHash } from "node:crypto";
import { findAttribute, isPlainTextElement, readElementName, walkSyntaxTree } from "./syntax-tree.js";

/** @typedef {import("./syntax-tree.js").SyntaxNode} SyntaxNode */
/** @typedef {"text" | "picture" | "box"} EditKind */

// Engine parts that pass the marks on to their own element; a group only marks its place for moved boxes.
/** @type {Record<string, EditKind | undefined>} */
const markedEngineParts = { Caption: "text", Source: "text", BigNumber: "text", Quote: "text", Image: "picture", Box: "box", Group: undefined };
const unwritableTextTags = new Set(["pre", "script", "style", "textarea", "title"]);
const sourceVersionLength = 12;

/** @param {string} sourceCode */
export function hashSourceCode(sourceCode) {
  return createHash("sha1").update(sourceCode).digest("hex").slice(0, sourceVersionLength);
}

/** @param {string} sourceCode */
export function findLineStarts(sourceCode) {
  const lineStarts = [0];
  for (let characterIndex = 0; characterIndex < sourceCode.length; characterIndex += 1) {
    if (sourceCode[characterIndex] === "\n") lineStarts.push(characterIndex + 1);
  }
  return lineStarts;
}

// Lines and columns count from 1, as editors and terminals show them: index.tsx:42:7.
/**
 * @param {number[]} lineStarts
 * @param {number} sourceOffset
 */
function describeOffset(lineStarts, sourceOffset) {
  let lineIndex = lineStarts.length - 1;
  while (lineStarts[lineIndex] > sourceOffset) lineIndex -= 1;
  return `${lineIndex + 1}:${sourceOffset - lineStarts[lineIndex] + 1}`;
}

/** @param {SyntaxNode} elementNode */
function hasReplaceablePicture(elementNode) {
  const pictureValue = findAttribute(elementNode, "src")?.value;
  if (pictureValue?.type === "Literal") return typeof pictureValue.value === "string";
  return pictureValue?.type === "JSXExpressionContainer" && pictureValue.expression.type === "Identifier";
}

/**
 * @param {SyntaxNode} elementNode
 * @param {string} elementName
 * @param {EditKind | undefined} engineKind
 * @returns {EditKind | undefined}
 */
function pickEditKind(elementNode, elementName, engineKind) {
  if (engineKind === "box") return "box";
  if (engineKind === "picture" || elementName === "img") return hasReplaceablePicture(elementNode) ? "picture" : undefined;
  const writesText = engineKind === "text" || (/^[a-z]/.test(elementName) && !unwritableTextTags.has(elementName));
  return writesText && isPlainTextElement(elementNode) ? "text" : undefined;
}

// The file version is reported too, so a stale page never writes over newer code.
/**
 * @param {SyntaxNode} syntaxTree
 * @param {import("magic-string").default} editedSource
 * @param {string} sourceCode
 * @param {string} relativeFile
 * @param {Record<string, string>} engineNames
 */
export function markSourceLocations(syntaxTree, editedSource, sourceCode, relativeFile, engineNames) {
  const lineStarts = findLineStarts(sourceCode);
  const engineKinds = new Map(
    Object.entries(markedEngineParts).flatMap(([engineName, engineKind]) =>
      engineNames[engineName] === undefined ? [] : [/** @type {const} */ ([engineNames[engineName], engineKind])],
    ),
  );
  walkSyntaxTree(syntaxTree, (syntaxNode) => {
    if (syntaxNode.type !== "JSXElement") return;
    const elementName = readElementName(syntaxNode);
    if (elementName === undefined || (!/^[a-z]/.test(elementName) && !engineKinds.has(elementName))) return;
    const editKind = pickEditKind(syntaxNode, elementName, engineKinds.get(elementName));
    const sourceLocation = `${relativeFile}:${describeOffset(lineStarts, syntaxNode.start)}`;
    const editAttribute = editKind === undefined ? "" : ` data-source-edit="${editKind}"`;
    editedSource.appendLeft(syntaxNode.openingElement.name.end, ` data-source-location={${JSON.stringify(sourceLocation)}}${editAttribute}`);
  });
  const versionStatement = `(window.slidemachinaSourceVersions ??= {})[${JSON.stringify(relativeFile)}] = ${JSON.stringify(hashSourceCode(sourceCode))};`;
  editedSource.append(`\n${versionStatement}\n`);
}
