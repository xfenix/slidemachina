import Typograf from "typograf";
import { pickTextLanguage } from "../../shared-between-runtimes/text-language.js";

// A neighbouring element is out of sight for the typographer, so a stand-in word keeps the space next to it.
const neighbourStandIn = "Ограда";

/** @type {Record<string, string>} */
const namedEntities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
  hellip: "…",
};

/** @type {Map<string, Typograf>} */
const typographersByLocale = new Map();

/**
 * @param {string} languageCode
 * @returns {Typograf}
 */
function pickTypographer(languageCode) {
  const localeNames = pickTextLanguage(languageCode) === "ru" ? ["ru", "en-US"] : ["en-US"];
  const localeKey = localeNames.join(",");
  if (!typographersByLocale.has(localeKey)) {
    const typographer = new Typograf({ locale: localeNames });
    // Code in a sentence, such as align="center": "= does not open a quote for Typograf, so it would close it with ».
    typographer.addSafeTag(/[\w-]+=(?:"[^"\n]*"|'[^'\n]*')/g);
    typographersByLocale.set(localeKey, typographer);
  }
  return /** @type {Typograf} */ (typographersByLocale.get(localeKey));
}

// Returns undefined for an entity it does not know, so that text is left alone.
/** @param {string} encodedText */
export function decodeEntities(encodedText) {
  let hasUnknownEntity = false;
  const decodedText = encodedText.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (/** @type {string} */ entityText, /** @type {string} */ entityBody) => {
    if (entityBody.startsWith("#x") || entityBody.startsWith("#X")) return String.fromCodePoint(Number.parseInt(entityBody.slice(2), 16));
    if (entityBody.startsWith("#")) return String.fromCodePoint(Number.parseInt(entityBody.slice(1), 10));
    if (entityBody in namedEntities) return namedEntities[entityBody];
    hasUnknownEntity = true;
    return entityText;
  });
  return hasUnknownEntity ? undefined : decodedText;
}

// The same whitespace rules the JSX compiler applies: lines are trimmed and joined with one space.
/** @param {string} rawJsxText */
export function cookJsxText(rawJsxText) {
  const textLines = rawJsxText.split(/\r\n|\n|\r/);
  const lastFilledLine = textLines.findLastIndex((textLine) => /[^ \t]/.test(textLine));
  let cookedText = "";
  textLines.forEach((textLine, lineIndex) => {
    let trimmedLine = textLine.replace(/\t/g, " ");
    if (lineIndex > 0) trimmedLine = trimmedLine.replace(/^ +/, "");
    if (lineIndex < textLines.length - 1) trimmedLine = trimmedLine.replace(/ +$/, "");
    if (trimmedLine === "") return;
    cookedText += lineIndex === lastFilledLine ? trimmedLine : `${trimmedLine} `;
  });
  return decodeEntities(cookedText);
}

/**
 * @param {string} plainText
 * @param {string} languageCode
 */
export function typographText(plainText, languageCode) {
  if (plainText.trim() === "") return plainText;
  const typographer = pickTypographer(languageCode);
  const startsWithSpace = /^\s/.test(plainText);
  const endsWithSpace = /\s$/.test(plainText);
  const guardedText = `${startsWithSpace ? neighbourStandIn : ""}${plainText}${endsWithSpace ? neighbourStandIn : ""}`;
  let typographedText = typographer.execute(guardedText);
  const keepsStandIns =
    (!startsWithSpace || typographedText.startsWith(neighbourStandIn)) && (!endsWithSpace || typographedText.endsWith(neighbourStandIn));
  if (!keepsStandIns) {
    const leadingSpace = /^\s*/.exec(plainText)?.[0] ?? "";
    const trailingSpace = /\s*$/.exec(plainText)?.[0] ?? "";
    return `${leadingSpace}${typographer.execute(plainText.trim())}${trailingSpace}`;
  }
  if (startsWithSpace) typographedText = typographedText.slice(neighbourStandIn.length);
  if (endsWithSpace) typographedText = typographedText.slice(0, -neighbourStandIn.length);
  return typographedText;
}
