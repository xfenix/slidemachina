import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BundledLanguage } from "shiki";
import type { Element, Text } from "hast";

type CodeToken = string | [string, string | undefined, string | undefined];
type HighlightedLine = { tokens: CodeToken[], marked: boolean, number: number };
type HighlightedCode = { lines: HighlightedLine[] };
type SavedHighlights = { shikiVersion: string, highlights: [string, HighlightedCode][] };

const codeThemes = { light: "github-light-high-contrast", dark: "github-dark-default" };
const highlightedBlocks = new Map<string, Promise<HighlightedCode>>();
const savedHighlightsFileName = "slidemachina-highlights.json";
const savingDelayMilliseconds = 300;
// Colours come from the themes of this Shiki: after an update the saved tokens are highlighted afresh.
const shikiVersion = (JSON.parse(readFileSync(fileURLToPath(import.meta.resolve("shiki/package.json")), "utf8")) as { version: string }).version;
const usedHighlights = new Map<string, HighlightedCode>();
let savedHighlights = new Map<string, HighlightedCode>();
let savedHighlightsPath: string | undefined;
let savingTimer: NodeJS.Timeout | undefined;

// The first block of a language costs Shiki a tenth of a second: a restart takes the tokens of the last run from the cache folder.
export function keepHighlightsIn(cacheFolder: string): void {
  savedHighlightsPath = path.join(cacheFolder, savedHighlightsFileName);
  try {
    const savedFile = JSON.parse(readFileSync(savedHighlightsPath, "utf8")) as SavedHighlights;
    if (savedFile.shikiVersion === shikiVersion) savedHighlights = new Map(savedFile.highlights);
  } catch {
    // No file yet or a broken one: the code is highlighted afresh.
  }
}

// Only the blocks of this run are saved, so the file does not grow with every edit.
function rememberHighlight(highlightKey: string, highlightedCode: HighlightedCode): void {
  usedHighlights.set(highlightKey, highlightedCode);
  if (savedHighlightsPath === undefined) return;
  const highlightsPath = savedHighlightsPath;
  clearTimeout(savingTimer);
  savingTimer = setTimeout(() => {
    mkdirSync(path.dirname(highlightsPath), { recursive: true });
    const savedFile: SavedHighlights = { shikiVersion, highlights: [...usedHighlights] };
    writeFileSync(highlightsPath, JSON.stringify(savedFile));
  }, savingDelayMilliseconds);
  savingTimer.unref();
}

async function loadHighlighter(languageName: string) {
  // Shiki loads only when a block is not in the saved highlights.
  const { getSingletonHighlighter } = await import("shiki");
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

// An edit re-runs the whole file through the plugin: unchanged blocks take their tokens from here instead of Shiki.
export function highlightCodeOnce(codeText: string, languageName: string, isWholeFile: boolean): Promise<HighlightedCode> {
  const highlightKey = JSON.stringify([languageName, isWholeFile, codeText]);
  let highlighting = highlightedBlocks.get(highlightKey);
  if (highlighting === undefined) {
    const savedHighlight = savedHighlights.get(highlightKey);
    highlighting = savedHighlight === undefined ? highlightCode(codeText, languageName, isWholeFile) : Promise.resolve(savedHighlight);
    highlightedBlocks.set(highlightKey, highlighting);
    highlighting.then((highlightedCode) => rememberHighlight(highlightKey, highlightedCode), () => undefined);
  }
  return highlighting;
}

// Shiki runs only here, at build time: the browser gets coloured tokens and never loads grammars.
async function highlightCode(codeText: string, languageName: string, isWholeFile: boolean): Promise<HighlightedCode> {
  const [{ shikiHighlighter, loadedLanguage }, { transformerNotationHighlight }] = await Promise.all([loadHighlighter(languageName), import("@shikijs/transformers")]);
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
