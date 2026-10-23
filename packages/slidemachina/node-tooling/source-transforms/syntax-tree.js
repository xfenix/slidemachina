import { parseAst } from "vite";

// ESTree nodes are walked by field name, so a loose shape is enough here.
/** @typedef {{ type: string, start: number, end: number, [nodeField: string]: any }} SyntaxNode */

/**
 * @param {string} sourceCode
 * @param {string} filePath
 * @returns {SyntaxNode}
 */
export function parseSlideSource(sourceCode, filePath) {
  return /** @type {SyntaxNode} */ (/** @type {unknown} */ (parseAst(sourceCode, { lang: filePath.endsWith(".jsx") ? "jsx" : "tsx" })));
}

/**
 * @param {unknown} syntaxNode
 * @param {(visitedNode: SyntaxNode, ancestorNodes: SyntaxNode[]) => void} visitNode
 * @param {SyntaxNode[]} [ancestorNodes]
 */
export function walkSyntaxTree(syntaxNode, visitNode, ancestorNodes = []) {
  if (Array.isArray(syntaxNode)) {
    for (const childNode of syntaxNode) walkSyntaxTree(childNode, visitNode, ancestorNodes);
    return;
  }
  if (syntaxNode === null || typeof syntaxNode !== "object" || !("type" in syntaxNode) || typeof syntaxNode.type !== "string") return;
  const visitedNode = /** @type {SyntaxNode} */ (syntaxNode);
  visitNode(visitedNode, ancestorNodes);
  ancestorNodes.push(visitedNode);
  for (const propertyValue of Object.values(visitedNode)) {
    if (propertyValue !== null && typeof propertyValue === "object") walkSyntaxTree(propertyValue, visitNode, ancestorNodes);
  }
  ancestorNodes.pop();
}

/**
 * @param {SyntaxNode} elementNode
 * @returns {string | undefined}
 */
export function readElementName(elementNode) {
  const nameNode = elementNode.openingElement.name;
  return nameNode.type === "JSXIdentifier" ? nameNode.name : undefined;
}

/**
 * @param {SyntaxNode} elementNode
 * @param {string} attributeName
 * @returns {SyntaxNode | undefined}
 */
export function findAttribute(elementNode, attributeName) {
  return elementNode.openingElement.attributes.find(
    (/** @type {SyntaxNode} */ attributeNode) => attributeNode.type === "JSXAttribute" && attributeNode.name.name === attributeName,
  );
}

/**
 * @param {SyntaxNode} elementNode
 * @param {string} attributeName
 * @returns {string | undefined}
 */
export function readStringAttribute(elementNode, attributeName) {
  const attributeValue = findAttribute(elementNode, attributeName)?.value;
  if (attributeValue?.type === "Literal" && typeof attributeValue.value === "string") return attributeValue.value;
  if (attributeValue?.type === "JSXExpressionContainer" && typeof attributeValue.expression.value === "string") {
    return attributeValue.expression.value;
  }
  return undefined;
}

// <Code as Snippet> still works: names are taken from the import of "slidemachina".
/**
 * @param {SyntaxNode} syntaxTree
 * @returns {Record<string, string>}
 */
export function findEngineNames(syntaxTree) {
  /** @type {Record<string, string>} */
  const engineNames = {};
  for (const statementNode of syntaxTree.body) {
    if (statementNode.type !== "ImportDeclaration" || statementNode.source.value !== "slidemachina") continue;
    for (const specifierNode of statementNode.specifiers) {
      if (specifierNode.type === "ImportSpecifier") engineNames[specifierNode.imported.name] = specifierNode.local.name;
    }
  }
  return engineNames;
}

/** @param {SyntaxNode} syntaxNode */
export function isStringContainer(syntaxNode) {
  if (syntaxNode.type !== "JSXExpressionContainer") return false;
  const containedExpression = syntaxNode.expression;
  if (containedExpression.type === "Literal") return typeof containedExpression.value === "string";
  return containedExpression.type === "TemplateLiteral" && containedExpression.expressions.length === 0;
}

// Only text and string literals inside: such an element can be rewritten as a whole from the slide.
/** @param {SyntaxNode} elementNode */
export function isPlainTextElement(elementNode) {
  /** @type {SyntaxNode[]} */
  const elementChildren = elementNode.children;
  const holdsOnlyText = elementChildren.every((childNode) => childNode.type === "JSXText" || isStringContainer(childNode));
  const holdsSomeText = elementChildren.some((childNode) => childNode.type !== "JSXText" || childNode.value.trim() !== "");
  return elementChildren.length > 0 && holdsOnlyText && holdsSomeText;
}
