import { getSingletonHighlighter } from "shiki";
import { transformerNotationHighlight } from "@shikijs/transformers";
import type { BundledLanguage } from "shiki";
import type { Element, Text } from "hast";

type CodeToken = string | [string, string | undefined, string | undefined];

const codeThemes = { light: "github-light-high-contrast", dark: "github-dark-default" };

async function loadHighlighter(languageName: string) {
  const shikiHighlighter = await getSingletonHighlighter({ themes: Object.values(codeThemes), langs: [] });
  try {
    await shikiHighlighter.loadLanguage(languageName as BundledLanguage);
    return { shikiHighlighter, loadedLanguage: languageName };
  } catch {
    return { shikiHighlighter, loadedLanguage: "text" };
  }
}

// Code inside JSX is indented with the markup; the slide shows it from the left edge.
function dedentCode(codeText: string): string {
  const codeLines = codeText.replace(/\r\n?/g, "\n").split("\n");
  while (codeLines.length > 0 && codeLines[0].trim() === "") codeLines.shift();
  while (codeLines.length > 0 && codeLines.at(-1)?.trim() === "") codeLines.pop();
  const indentWidths = codeLines.filter((codeLine) => codeLine.trim() !== "").map((codeLine) => codeLine.search(/\S/));
  const commonIndent = indentWidths.length > 0 ? Math.min(...indentWidths) : 0;
  return codeLines.map((codeLine) => codeLine.slice(commonIndent)).join("\n");
}

function readStyleColor(inlineStyle: unknown, propertyName: string): string | undefined {
  return new RegExp(`${propertyName}:([^;]+)`).exec(typeof inlineStyle === "string" ? inlineStyle : "")?.[1];
}

// A token is [text, light colour, dark colour]; whitespace stays a plain string so it never becomes a morph layer.
function compactLineElement(lineElement: Element): { tokens: CodeToken[], marked: boolean } {
  const tokenElements = lineElement.children as Element[];
  const lineTokens: CodeToken[] = tokenElements.map((tokenElement) => {
    const tokenText = (tokenElement.children as Text[]).map((textNode) => textNode.value).join("");
    if (tokenText.trim() === "") return tokenText;
    const tokenStyle = tokenElement.properties.style;
    return [tokenText, readStyleColor(tokenStyle, "--shiki-light"), readStyleColor(tokenStyle, "--shiki-dark")];
  });
  while (typeof lineTokens.at(-1) === "string") lineTokens.pop();
  const lineClasses = [lineElement.properties.class ?? []].flat();
  return { tokens: lineTokens, marked: lineClasses.includes("highlighted") };
}

// Shiki runs only here, at build time: the browser gets coloured tokens and never loads grammars.
export async function highlightCode(codeText: string, languageName: string): Promise<{ lines: { tokens: CodeToken[], marked: boolean }[] }> {
  const { shikiHighlighter, loadedLanguage } = await loadHighlighter(languageName);
  const codeTree = shikiHighlighter.codeToHast(dedentCode(codeText), {
    lang: loadedLanguage,
    themes: codeThemes,
    defaultColor: false,
    mergeWhitespaces: false,
    transformers: [transformerNotationHighlight()],
  });
  const preElement = codeTree.children[0] as Element;
  const codeElement = preElement.children[0] as Element;
  const lineElements = codeElement.children.filter((childNode) => childNode.type === "element");
  return { lines: lineElements.map(compactLineElement) };
}
