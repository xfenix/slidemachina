import { readElementName } from "./syntax-tree.ts";
import type { SyntaxNode } from "./syntax-tree.ts";

// An opening mark begins a line at the start of a text or after a plain space: a non-breaking space never breaks.
const openingMarkPattern = /(^| )([«„“‘(])/g;
// Text in these runs on in the same line as the text before them.
const inlineTextElements = new Set(["a", "abbr", "b", "cite", "em", "i", "mark", "q", "s", "small", "span", "strong", "sub", "sup", "u"]);

function isFilledChild(childNode: SyntaxNode): boolean {
  return childNode.type !== "JSXText" || childNode.value.trim() !== "";
}

// The text opens a line when nothing comes before it up to the nearest block: <p> or a component.
// A list item opens with its bullet, and a mark hanging there would run into it.
export function isAtLineStart(textNode: SyntaxNode, ancestorNodes: SyntaxNode[], engineNames: Record<string, string>): boolean {
  let childNode = textNode;
  for (const parentNode of ancestorNodes.toReversed()) {
    if (parentNode.type !== "JSXElement" && parentNode.type !== "JSXFragment") return false;
    if (parentNode.children.find(isFilledChild) !== childNode) return false;
    const elementName = parentNode.type === "JSXElement" ? readElementName(parentNode) : undefined;
    if (elementName === "li" || elementName === engineNames.List) return false;
    const runsInline = parentNode.type === "JSXFragment" || inlineTextElements.has(elementName ?? "");
    if (!runsInline) return true;
    childNode = parentNode;
  }
  return false;
}

// The mark gets zero width and hangs to the left; the space before it carries a hidden copy, so mid-line nothing moves.
export function writeHangingPunctuationCode(typographedText: string, startsLine: boolean): string | undefined {
  const codePieces: string[] = [];
  let copiedLength = 0;
  for (const markMatch of typographedText.matchAll(openingMarkPattern)) {
    const spaceBefore = markMatch[1]!;
    const openingMark = markMatch[2]!;
    if (spaceBefore === "" && !startsLine) continue;
    codePieces.push(`{${JSON.stringify(typographedText.slice(copiedLength, markMatch.index))}}`);
    if (spaceBefore !== "") codePieces.push(`<span data-hanging-space=${JSON.stringify(openingMark)}>{" "}</span>`);
    codePieces.push(`<span data-hanging-mark>{${JSON.stringify(openingMark)}}</span>`);
    copiedLength = markMatch.index + markMatch[0].length;
  }
  if (codePieces.length === 0) return undefined;
  codePieces.push(`{${JSON.stringify(typographedText.slice(copiedLength))}}`);
  return codePieces.filter((codePiece) => codePiece !== `{""}`).join("");
}
