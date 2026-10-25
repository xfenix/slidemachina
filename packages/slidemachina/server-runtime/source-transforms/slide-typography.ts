import { isAtLineStart, writeHangingPunctuationCode } from "./hanging-punctuation.ts";
import { readElementName } from "./syntax-tree.ts";
import { cookJsxText, decodeEntities, typographText } from "./text-typography.ts";
import type { SyntaxNode } from "./syntax-tree.ts";
import type MagicString from "magic-string";
import type { PresentationSettings } from "./presentation-settings.ts";

type TransformContext = { editedSource: MagicString, sourceCode: string, engineNames: Record<string, string>, presentationSettings: PresentationSettings };

// Text on these elements is code or markup, the typographer leaves it as written.
const untouchedTextElements = new Set(["code", "pre", "kbd", "samp", "script", "style"]);
const typographedAttributes = new Set(["title", "label", "author", "breadcrumbs"]);

function isInsideUntouchedElement(ancestorNodes: SyntaxNode[], codeName: string | undefined): boolean {
  return ancestorNodes.some((ancestorNode) => {
    if (ancestorNode.type !== "JSXElement") return false;
    const elementName = readElementName(ancestorNode);
    return elementName === codeName || (elementName !== undefined && untouchedTextElements.has(elementName));
  });
}

function isInsideElementNamed(ancestorNodes: SyntaxNode[], elementName: string | undefined): boolean {
  return ancestorNodes.some((ancestorNode) => ancestorNode.type === "JSXElement" && readElementName(ancestorNode) === elementName);
}

// A replaced text keeps its line breaks after it, so the following code stays on the same lines.
function replaceKeepingLines(editedSource: MagicString, syntaxNode: SyntaxNode, replacementCode: string, originalCode: string): void {
  const lineBreakCount = originalCode.slice(syntaxNode.start, syntaxNode.end).split("\n").length - 1;
  editedSource.overwrite(syntaxNode.start, syntaxNode.end, replacementCode + "\n".repeat(lineBreakCount));
}

export function typographSyntaxNode(syntaxNode: SyntaxNode, ancestorNodes: SyntaxNode[], transformContext: TransformContext): void {
  const { editedSource, sourceCode, engineNames, presentationSettings } = transformContext;
  const parentNode = ancestorNodes.at(-1);
  if (syntaxNode.type === "JSXText" && syntaxNode.value.trim() !== "") {
    if (isInsideUntouchedElement(ancestorNodes, engineNames.Code)) return;
    const cookedText = cookJsxText(syntaxNode.value);
    if (cookedText === undefined || cookedText === "") return;
    const typographedText = typographText(cookedText, presentationSettings.languageCode);
    // Scene text is drawn from plain strings, so a mark wrapped in an element would vanish from it.
    const hangingPunctuationCode = isInsideElementNamed(ancestorNodes, engineNames.Scene)
      ? undefined
      : writeHangingPunctuationCode(typographedText, isAtLineStart(syntaxNode, ancestorNodes, engineNames));
    if (hangingPunctuationCode !== undefined) {
      replaceKeepingLines(editedSource, syntaxNode, hangingPunctuationCode, sourceCode);
    } else if (typographedText !== cookedText) {
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
