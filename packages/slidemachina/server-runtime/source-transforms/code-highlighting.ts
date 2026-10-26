import { getSingletonHighlighter } from "shiki";
import { transformerNotationHighlight } from "@shikijs/transformers";
import type { BundledLanguage, ThemeRegistration } from "shiki";
import type { Element, Text } from "hast";

// The slide colours a token by its role: the text colour, a keyword in the accent, a literal in the second accent, a comment muted.
type CodeColorRole = "text" | "keyword" | "literal" | "comment";
type CodeToken = string | [string, CodeColorRole];
type HighlightedLine = { tokens: CodeToken[], marked: boolean, number: number };

const textRole: CodeColorRole = "text";
// Shiki takes any string for a colour, so the theme writes roles instead of colours; punctuation stays in the text colour, so a line has three colours at most.
const codeTheme: ThemeRegistration = {
  name: "slidemachina-roles",
  type: "light",
  colors: { "editor.foreground": textRole },
  tokenColors: [
    { scope: ["keyword", "storage", "entity.name.tag", "support.class.component", "meta.function.decorator", "keyword.operator.new", "keyword.operator.expression"], settings: { foreground: "keyword" } },
    // Words of a shell command are parsed as unquoted strings: they stay text, only a quoted string is a literal.
    { scope: ["keyword.operator", "punctuation.definition.tag", "punctuation.section.embedded", "string.unquoted.argument", "constant.other.option"], settings: { foreground: textRole } },
    { scope: ["string", "constant.numeric", "constant.language", "constant.character"], settings: { foreground: "literal" } },
    { scope: ["comment", "string.quoted.docstring"], settings: { foreground: "comment" } },
  ],
};

async function loadHighlighter(languageName: string) {
  const shikiHighlighter = await getSingletonHighlighter({ themes: [codeTheme], langs: [] });
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

function readColorRole(inlineStyle: unknown): CodeColorRole {
  return (/color:(\w+)/.exec(typeof inlineStyle === "string" ? inlineStyle : "")?.[1] as CodeColorRole | undefined) ?? textRole;
}

// A token is [text, colour role]. Shiki joins neighbours of one colour, so tokens are split back into words:
// a code morph moves words, and whitespace stays a plain string so it never becomes a morph layer.
function compactLineElement(lineElement: Element): HighlightedLine {
  const tokenElements = lineElement.children as Element[];
  const lineTokens: CodeToken[] = tokenElements.flatMap((tokenElement) => {
    const tokenText = (tokenElement.children as Text[]).map((textNode) => textNode.value).join("");
    const colorRole = readColorRole(tokenElement.properties.style);
    return tokenText
      .split(/(\s+)/)
      .filter((textPiece) => textPiece !== "")
      .map((textPiece): CodeToken => (textPiece.trim() === "" ? textPiece : [textPiece, colorRole]));
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
    theme: codeTheme,
    mergeWhitespaces: false,
    // The number is taken before the notation transformer drops lines that hold only a [!code …] comment.
    transformers: [{ line: (lineElement, sourceLineNumber) => void (lineElement.properties.dataSourceLine = sourceLineNumber) }, transformerNotationHighlight()],
  });
  const preElement = codeTree.children[0] as Element;
  const codeElement = preElement.children[0] as Element;
  const lineElements = codeElement.children.filter((childNode) => childNode.type === "element");
  return { lines: lineElements.map(compactLineElement) };
}
