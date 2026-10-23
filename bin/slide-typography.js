import { readElementName } from "./syntax-tree.js";
import { cookJsxText, decodeEntities, typographText } from "./text-typography.js";

/** @typedef {import("./syntax-tree.js").SyntaxNode} SyntaxNode */
/**
 * @typedef {object} TransformContext
 * @property {import("magic-string").default} editedSource
 * @property {string} sourceCode
 * @property {Record<string, string>} engineNames
 * @property {import("./presentation-settings.js").PresentationSettings} presentationSettings
 */

// Text on these elements is code or markup, the typographer leaves it as written.
const untouchedTextElements = new Set(["code", "pre", "kbd", "samp", "script", "style"]);
const typographedAttributes = new Set(["title", "label", "author", "breadcrumbs"]);

/**
 * @param {SyntaxNode[]} ancestorNodes
 * @param {string | undefined} codeName
 */
function isInsideUntouchedElement(ancestorNodes, codeName) {
  return ancestorNodes.some((ancestorNode) => {
    if (ancestorNode.type !== "JSXElement") return false;
    const elementName = readElementName(ancestorNode);
    return elementName === codeName || (elementName !== undefined && untouchedTextElements.has(elementName));
  });
}

// A replaced text keeps its line breaks after it, so the following code stays on the same lines.
/**
 * @param {import("magic-string").default} editedSource
 * @param {SyntaxNode} syntaxNode
 * @param {string} replacementCode
 * @param {string} originalCode
 */
function replaceKeepingLines(editedSource, syntaxNode, replacementCode, originalCode) {
  const lineBreakCount = originalCode.slice(syntaxNode.start, syntaxNode.end).split("\n").length - 1;
  editedSource.overwrite(syntaxNode.start, syntaxNode.end, replacementCode + "\n".repeat(lineBreakCount));
}

/**
 * @param {SyntaxNode} syntaxNode
 * @param {SyntaxNode[]} ancestorNodes
 * @param {TransformContext} transformContext
 */
export function typographSyntaxNode(syntaxNode, ancestorNodes, transformContext) {
  const { editedSource, sourceCode, engineNames, presentationSettings } = transformContext;
  const parentNode = ancestorNodes.at(-1);
  if (syntaxNode.type === "JSXText" && syntaxNode.value.trim() !== "") {
    if (isInsideUntouchedElement(ancestorNodes, engineNames.Code)) return;
    const cookedText = cookJsxText(syntaxNode.value);
    if (cookedText === undefined || cookedText === "") return;
    const typographedText = typographText(cookedText, presentationSettings.languageCode);
    if (typographedText !== cookedText) {
      replaceKeepingLines(editedSource, syntaxNode, `{${JSON.stringify(typographedText)}}`, sourceCode);
    }
  }
  if (syntaxNode.type === "Literal" && parentNode?.type === "JSXAttribute" && typographedAttributes.has(parentNode.name.name)) {
    const decodedText = typeof syntaxNode.value === "string" ? decodeEntities(syntaxNode.value) : undefined;
    if (decodedText === undefined) return;
    const typographedText = typographText(decodedText, presentationSettings.languageCode);
    if (typographedText !== decodedText) {
      replaceKeepingLines(editedSource, syntaxNode, `{${JSON.stringify(typographedText)}}`, sourceCode);
    }
  }
}
