import { parseAst } from "vite";

// ESTree nodes are walked by field name, so a loose shape is enough here.
export type SyntaxNode = { type: string, start: number, end: number, [nodeField: string]: any };

export function parseSlideSource(sourceCode: string, filePath: string): SyntaxNode {
  return parseAst(sourceCode, { lang: filePath.endsWith(".jsx") ? "jsx" : "tsx" }) as unknown as SyntaxNode;
}

export function walkSyntaxTree(syntaxNode: unknown, visitNode: (visitedNode: SyntaxNode, ancestorNodes: SyntaxNode[]) => void, ancestorNodes: SyntaxNode[] = []): void {
  if (Array.isArray(syntaxNode)) {
    for (const childNode of syntaxNode) walkSyntaxTree(childNode, visitNode, ancestorNodes);
    return;
  }
  if (syntaxNode === null || typeof syntaxNode !== "object" || !("type" in syntaxNode) || typeof syntaxNode.type !== "string") return;
  const visitedNode = syntaxNode as SyntaxNode;
  visitNode(visitedNode, ancestorNodes);
  ancestorNodes.push(visitedNode);
  for (const propertyValue of Object.values(visitedNode)) {
    if (propertyValue !== null && typeof propertyValue === "object") walkSyntaxTree(propertyValue, visitNode, ancestorNodes);
  }
  ancestorNodes.pop();
}

export function readElementName(elementNode: SyntaxNode): string | undefined {
  const nameNode = elementNode.openingElement.name;
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  // <Machina.Slide> after import * as Machina from "slidemachina".
  if (nameNode.type === "JSXMemberExpression" && nameNode.object.type === "JSXIdentifier") return `${nameNode.object.name}.${nameNode.property.name}`;
  return undefined;
}

export function findAttribute(elementNode: SyntaxNode, attributeName: string): SyntaxNode | undefined {
  return elementNode.openingElement.attributes.find(
    (attributeNode: SyntaxNode) => attributeNode.type === "JSXAttribute" && attributeNode.name.name === attributeName,
  );
}

export function readStringAttribute(elementNode: SyntaxNode, attributeName: string): string | undefined {
  const attributeValue = findAttribute(elementNode, attributeName)?.value;
  if (attributeValue?.type === "Literal" && typeof attributeValue.value === "string") return attributeValue.value;
  if (attributeValue?.type === "JSXExpressionContainer" && typeof attributeValue.expression.value === "string") {
    return attributeValue.expression.value;
  }
  return undefined;
}

// <Code as Snippet> and <Machina.Code> still work: names are taken from the import of "slidemachina".
export function findEngineNames(syntaxTree: SyntaxNode): Record<string, string> {
  const engineNames: Record<string, string> = {};
  let namespaceName: string | undefined;
  for (const statementNode of syntaxTree.body) {
    if (statementNode.type !== "ImportDeclaration" || statementNode.source.value !== "slidemachina") continue;
    for (const specifierNode of statementNode.specifiers) {
      if (specifierNode.type === "ImportSpecifier") engineNames[specifierNode.imported.name] = specifierNode.local.name;
      if (specifierNode.type === "ImportNamespaceSpecifier") namespaceName = specifierNode.local.name;
    }
  }
  if (namespaceName === undefined) return engineNames;
  return new Proxy(engineNames, {
    get: (importedNames, partName) => importedNames[partName as string] ?? `${namespaceName}.${String(partName)}`,
  });
}

export function isStringContainer(syntaxNode: SyntaxNode): boolean {
  if (syntaxNode.type !== "JSXExpressionContainer") return false;
  const containedExpression = syntaxNode.expression;
  if (containedExpression.type === "Literal") return typeof containedExpression.value === "string";
  return containedExpression.type === "TemplateLiteral" && containedExpression.expressions.length === 0;
}

// Only text and string literals inside: such an element can be rewritten as a whole from the slide.
export function isPlainTextElement(elementNode: SyntaxNode): boolean {
  const elementChildren: SyntaxNode[] = elementNode.children;
  const holdsOnlyText = elementChildren.every((childNode) => childNode.type === "JSXText" || isStringContainer(childNode));
  const holdsSomeText = elementChildren.some((childNode) => childNode.type !== "JSXText" || childNode.value.trim() !== "");
  return elementChildren.length > 0 && holdsOnlyText && holdsSomeText;
}
