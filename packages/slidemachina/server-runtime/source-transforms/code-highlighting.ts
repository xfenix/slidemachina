import { getSingletonHighlighter } from "shiki";
import { transformerNotationHighlight } from "@shikijs/transformers";
import type { BundledLanguage } from "shiki";
import type { Element, Text } from "hast";

type CodeToken = string | [string, string | undefined, string | undefined];
type HighlightedLine = { tokens: CodeToken[], marked: boolean, number: number };

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
// A file keeps its leading blank lines, so line numbers stay the numbers of the file.
function dedentCode(codeText: string, keepsLeadingLines: boolean): string {
  const codeLines = codeText.replace(/\r\n?/g, "\n").split("\n");
  while (!keepsLeadingLines && codeLines[0]?.trim() === "") codeLines.shift();
  while (codeLines.length > 0 && codeLines.at(-1)?.trim() === "") codeLines.pop();
  const indentWidths = codeLines.filter((codeLine) => codeLine.trim() !== "").map((codeLine) => codeLine.search(/\S/));
  const commonIndent = indentWidths.length > 0 ? Math.min(...indentWidths) : 0;
  return codeLines.map((codeLine) => codeLine.slice(commonIndent)).join("\n");
}

function readStyleColor(inlineStyle: unknown, propertyName: string): string | undefined {
  return new RegExp(`${propertyName}:([^;]+)`).exec(typeof inlineStyle === "string" ? inlineStyle : "")?.[1];
}

// A token is [text, light colour, dark colour]. Shiki joins neighbours of one colour, so tokens are split back into words:
// a code morph moves words, and whitespace stays a plain string so it never becomes a morph layer.
function compactLineElement(lineElement: Element): HighlightedLine {
  const tokenElements = lineElement.children as Element[];
  const lineTokens: CodeToken[] = tokenElements.flatMap((tokenElement) => {
    const tokenText = (tokenElement.children as Text[]).map((textNode) => textNode.value).join("");
    const tokenStyle = tokenElement.properties.style;
    const lightColor = readStyleColor(tokenStyle, "--shiki-light");
    const darkColor = readStyleColor(tokenStyle, "--shiki-dark");
    return tokenText
      .split(/(\s+)/)
      .filter((textPiece) => textPiece !== "")
      .map((textPiece): CodeToken => (textPiece.trim() === "" ? textPiece : [textPiece, lightColor, darkColor]));
  });
  while (typeof lineTokens.at(-1) === "string") lineTokens.pop();
  const lineClasses = [lineElement.properties.class ?? []].flat();
  return { tokens: lineTokens, marked: lineClasses.includes("highlighted"), number: Number(lineElement.properties.dataSourceLine) };
}

// Shiki runs only here, at build time: the browser gets coloured tokens and never loads grammars.
export async function highlightCode(codeText: string, languageName: string, isWholeFile: boolean): Promise<{ lines: HighlightedLine[] }> {
  const { shikiHighlighter, loadedLanguage } = await loadHighlighter(languageName);
  const codeTree = shikiHighlighter.codeToHast(dedentCode(codeText, isWholeFile), {
    lang: loadedLanguage,
    themes: codeThemes,
    defaultColor: false,
    mergeWhitespaces: false,
    // The number is taken before the notation transformer drops lines that hold only a [!code …] comment.
    transformers: [{ line: (lineElement, sourceLineNumber) => void (lineElement.properties.dataSourceLine = sourceLineNumber) }, transformerNotationHighlight()],
  });
  const preElement = codeTree.children[0] as Element;
  const codeElement = preElement.children[0] as Element;
  const lineElements = codeElement.children.filter((childNode) => childNode.type === "element");
  return { lines: lineElements.map(compactLineElement) };
}
