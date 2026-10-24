import { createHash } from "node:crypto";
import { findAttribute, isPlainTextElement, readElementName, walkSyntaxTree } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type MagicString from "magic-string";

type EditKind = "text" | "picture" | "box";

// Engine parts that pass the marks on to their own element; a group only marks its place for moved boxes.
const markedEngineParts: Record<string, EditKind | undefined> = { Caption: "text", Source: "text", BigNumber: "text", Quote: "text", Image: "picture", Box: "box", Group: undefined };
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
function describeOffset(lineStarts: number[], sourceOffset: number): string {
  const lineIndex = lineStarts.findLastIndex((lineStart) => lineStart <= sourceOffset);
  return `${lineIndex + 1}:${sourceOffset - lineStarts[lineIndex]! + 1}`;
}

function hasReplaceablePicture(elementNode: SyntaxNode): boolean {
  const pictureValue = findAttribute(elementNode, "src")?.value;
  if (pictureValue?.type === "Literal") return typeof pictureValue.value === "string";
  return pictureValue?.type === "JSXExpressionContainer" && pictureValue.expression.type === "Identifier";
}

function pickEditKind(elementNode: SyntaxNode, elementName: string, engineKind: EditKind | undefined): EditKind | undefined {
  if (engineKind === "box") return "box";
  if (engineKind === "picture" || elementName === "img") return hasReplaceablePicture(elementNode) ? "picture" : undefined;
  const writesText = engineKind === "text" || (/^[a-z]/.test(elementName) && !unwritableTextTags.has(elementName));
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
