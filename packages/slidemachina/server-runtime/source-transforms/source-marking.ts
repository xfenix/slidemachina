import { createHash } from "node:crypto";
import { findAttribute, isPlainTextElement, readElementName, walkSyntaxTree } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type MagicString from "magic-string";

type EditKind = "text" | "picture" | "box" | "attribute";

// Engine parts that pass the marks on to their own element; a group marks its place for moved boxes, a slide for slides added after it.
const markedEngineParts: Record<string, EditKind | undefined> = {
  Image: "picture",
  Video: "picture",
  Box: "box",
  Arrow: "attribute",
  Code: "attribute",
  Group: "attribute",
  Message: "attribute",
  Section: "attribute",
  Slide: undefined,
};
// The string prop each part edits: the mark names it, so the server knows what to rewrite.
const attributeEditNames: Record<string, string> = { Arrow: "label", Code: "title", Group: "title", Message: "label", Section: "title" };
const unwritableTextTags = new Set(["pre", "script", "style", "textarea", "title"]);
const sourceVersionLength = 12;

export function hashSourceCode(sourceCode: string): string {
  return createHash("sha1").update(sourceCode).digest("hex").slice(0, sourceVersionLength);
}

export function findLineStarts(sourceCode: string): number[] {
  const lineStarts = [0];
  for (let characterIndex = 0; characterIndex < sourceCode.length; characterIndex += 1) {
    if (sourceCode[characterIndex] === "\n") lineStarts.push(characterIndex + 1);
  }
  return lineStarts;
}

// Lines and columns count from 1, as editors and terminals show them: index.tsx:42:7.
export function describeOffset(lineStarts: number[], sourceOffset: number): string {
  const lineIndex = lineStarts.findLastIndex((lineStart) => lineStart <= sourceOffset);
  return `${lineIndex + 1}:${sourceOffset - lineStarts[lineIndex]! + 1}`;
}

function hasReplaceablePicture(elementNode: SyntaxNode): boolean {
  const pictureValue = findAttribute(elementNode, "src")?.value;
  if (pictureValue?.type === "Literal") return typeof pictureValue.value === "string";
  return pictureValue?.type === "JSXExpressionContainer" && pictureValue.expression.type === "Identifier";
}

function hasStringAttribute(elementNode: SyntaxNode, attributeName: string): boolean {
  const attributeValue = findAttribute(elementNode, attributeName)?.value;
  if (attributeValue?.type === "Literal") return typeof attributeValue.value === "string";
  return attributeValue?.type === "JSXExpressionContainer" && attributeValue.expression.type === "Literal" && typeof attributeValue.expression.value === "string";
}

function pickEditKind(elementNode: SyntaxNode, elementName: string, engineKind: EditKind | undefined): EditKind | undefined {
  if (engineKind === "box") return "box";
  if (engineKind === "attribute") return "attribute";
  if (engineKind === "picture" || elementName === "img") return hasReplaceablePicture(elementNode) ? "picture" : undefined;
  const writesText = /^[a-z]/.test(elementName) && !unwritableTextTags.has(elementName);
  return writesText && isPlainTextElement(elementNode) ? "text" : undefined;
}

// The file version is reported too, so a stale page never writes over newer code.
export function markSourceLocations(syntaxTree: SyntaxNode, editedSource: MagicString, sourceCode: string, relativeFile: string, engineNames: Record<string, string>): void {
  const lineStarts = findLineStarts(sourceCode);
  const engineKinds = new Map(
    Object.entries(markedEngineParts).flatMap(([engineName, engineKind]) =>
      engineNames[engineName] === undefined ? [] : [[engineNames[engineName], engineKind] as const],
    ),
  );
  const engineAttributeNames = new Map(
    Object.entries(attributeEditNames).flatMap(([engineName, attributeName]) =>
      engineNames[engineName] === undefined ? [] : [[engineNames[engineName], attributeName] as const],
    ),
  );
  walkSyntaxTree(syntaxTree, (syntaxNode) => {
    if (syntaxNode.type !== "JSXElement") return;
    const elementName = readElementName(syntaxNode);
    if (elementName === undefined || (!/^[a-z]/.test(elementName) && !engineKinds.has(elementName))) return;
    const editKind = pickEditKind(syntaxNode, elementName, engineKinds.get(elementName));
    const attributeName = engineAttributeNames.get(elementName);
    const marksAttribute = editKind === "attribute" && attributeName !== undefined && hasStringAttribute(syntaxNode, attributeName);
    const sourceLocation = `${relativeFile}:${describeOffset(lineStarts, syntaxNode.start)}`;
    const editAttribute =
      editKind === undefined || (editKind === "attribute" && !marksAttribute)
        ? ""
        : ` data-source-edit="${editKind}"${editKind === "attribute" ? ` data-source-attribute="${attributeName}"` : ""}`;
    editedSource.appendLeft(syntaxNode.openingElement.name.end, ` data-source-location={${JSON.stringify(sourceLocation)}}${editAttribute}`);
  });
  const versionStatement = `(window.slidemachinaSourceVersions ??= {})[${JSON.stringify(relativeFile)}] = ${JSON.stringify(hashSourceCode(sourceCode))};`;
  editedSource.append(`\n${versionStatement}\n`);
}
