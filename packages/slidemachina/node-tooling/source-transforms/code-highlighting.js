import { getSingletonHighlighter } from "shiki";
import { transformerNotationHighlight } from "@shikijs/transformers";

/** @typedef {string | [string, string | undefined, string | undefined]} CodeToken */

const codeThemes = { light: "github-light-high-contrast", dark: "github-dark-default" };

/** @param {string} languageName */
async function loadHighlighter(languageName) {
  const shikiHighlighter = await getSingletonHighlighter({ themes: Object.values(codeThemes), langs: [] });
  try {
    await shikiHighlighter.loadLanguage(/** @type {import("shiki").BundledLanguage} */ (languageName));
    return { shikiHighlighter, loadedLanguage: languageName };
  } catch {
    return { shikiHighlighter, loadedLanguage: "text" };
  }
}

// Code inside JSX is indented with the markup; the slide shows it from the left edge.
/** @param {string} codeText */
function dedentCode(codeText) {
  const codeLines = codeText.replace(/\r\n?/g, "\n").split("\n");
  while (codeLines.length > 0 && codeLines[0].trim() === "") codeLines.shift();
  while (codeLines.length > 0 && codeLines.at(-1)?.trim() === "") codeLines.pop();
  const indentWidths = codeLines.filter((codeLine) => codeLine.trim() !== "").map((codeLine) => codeLine.search(/\S/));
  const commonIndent = indentWidths.length > 0 ? Math.min(...indentWidths) : 0;
  return codeLines.map((codeLine) => codeLine.slice(commonIndent)).join("\n");
}

/**
 * @param {unknown} inlineStyle
 * @param {string} propertyName
 */
function readStyleColor(inlineStyle, propertyName) {
  return new RegExp(`${propertyName}:([^;]+)`).exec(String(inlineStyle ?? ""))?.[1];
}

// A token is [text, light colour, dark colour]; whitespace stays a plain string so it never becomes a morph layer.
/** @param {import("hast").Element} lineElement */
function compactLineElement(lineElement) {
  const tokenElements = /** @type {import("hast").Element[]} */ (lineElement.children);
  /** @type {CodeToken[]} */
  const lineTokens = tokenElements.map((tokenElement) => {
    const tokenText = /** @type {import("hast").Text[]} */ (tokenElement.children).map((textNode) => textNode.value).join("");
    if (tokenText.trim() === "") return tokenText;
    const tokenStyle = tokenElement.properties.style;
    return [tokenText, readStyleColor(tokenStyle, "--shiki-light"), readStyleColor(tokenStyle, "--shiki-dark")];
  });
  while (typeof lineTokens.at(-1) === "string") lineTokens.pop();
  const lineClasses = [lineElement.properties.class ?? []].flat();
  return { tokens: lineTokens, marked: lineClasses.includes("highlighted") };
}

// Shiki runs only here, at build time: the browser gets coloured tokens and never loads grammars.
/**
 * @param {string} codeText
 * @param {string} languageName
 */
export async function highlightCode(codeText, languageName) {
  const { shikiHighlighter, loadedLanguage } = await loadHighlighter(languageName);
  const codeTree = shikiHighlighter.codeToHast(dedentCode(codeText), {
    lang: loadedLanguage,
    themes: codeThemes,
    defaultColor: false,
    mergeWhitespaces: false,
    transformers: [transformerNotationHighlight()],
  });
  const preElement = /** @type {import("hast").Element} */ (codeTree.children[0]);
  const codeElement = /** @type {import("hast").Element} */ (preElement.children[0]);
  const lineElements = codeElement.children.filter((childNode) => childNode.type === "element");
  return { lines: lineElements.map(compactLineElement) };
}
