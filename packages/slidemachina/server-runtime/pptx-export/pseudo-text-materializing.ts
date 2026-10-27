import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";

// Page functions, see slide-style-reading.ts. Text of ::before and ::after, such as quotes, the dash before an author or the crumb separator,
// becomes a span with the pseudo-element's computed style: PowerPoint gets it as letters of the line, right beside the words.
export const pseudoTextPageFunctions = [readQuotePair, readPseudoText, materializePseudoText];

function readQuotePair(hostElement: Element): [string, string] {
  const listedQuotes = [...getComputedStyle(hostElement).quotes.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(([, quoteText]) => quoteText!.replaceAll(/\\(.)/g, "$1"));
  if (listedQuotes.length >= 2) return [listedQuotes[0]!, listedQuotes[1]!];
  const languageCode = hostElement.closest("[lang]")?.getAttribute("lang") ?? "";
  return languageCode.startsWith("ru") ? pageReadingConstants.russianQuotes : pageReadingConstants.englishQuotes;
}

// Strings and quotes only: a counter, attr() or a picture leaves the pseudo-element to the picture of the slide.
function readPseudoText(hostElement: Element, pseudoName: string): string | undefined {
  const pseudoStyle = getComputedStyle(hostElement, pseudoName);
  if (pseudoStyle.display === "none" || pseudoStyle.visibility !== "visible") return undefined;
  const [openingQuote, closingQuote] = readQuotePair(hostElement);
  let pseudoText = "";
  for (const [contentToken, quotedText] of pseudoStyle.content.matchAll(/"((?:[^"\\]|\\.)*)"|\/|[^\s"/]+/g)) {
    if (contentToken === "/") break;
    if (quotedText !== undefined) pseudoText += quotedText.replaceAll(/\\(.)/g, "$1");
    else if (contentToken === "open-quote") pseudoText += openingQuote;
    else if (contentToken === "close-quote") pseudoText += closingQuote;
    else return undefined;
  }
  return pseudoText.trim() === "" ? undefined : pseudoText;
}

// A span that moves anything goes away again, and the pseudo-element stays in the picture.
export function materializePseudoText(pageElement: HTMLElement): void {
  const { wholeElement, pseudoBefore, pseudoAfter } = pptxPageMarks;
  const keptHolders = `${pageReadingConstants.keptPseudoHolders}, [${wholeElement}], [${wholeElement}] *`;
  for (const hostElement of pageElement.querySelectorAll(`*:not(${keptHolders})`)) {
    for (const [pseudoName, pseudoMark] of [["::before", pseudoBefore], ["::after", pseudoAfter]] as const) {
      const pseudoText = readPseudoText(hostElement, pseudoName);
      if (pseudoText === undefined) continue;
      const pseudoStyle = getComputedStyle(hostElement, pseudoName);
      const textSpan = document.createElement("span");
      for (const propertyName of pseudoStyle) {
        if (propertyName !== "content") textSpan.style.setProperty(propertyName, pseudoStyle.getPropertyValue(propertyName));
      }
      textSpan.textContent = pseudoText;
      const hostRectBefore = hostElement.getBoundingClientRect();
      hostElement.setAttribute(pseudoMark, "");
      if (pseudoName === "::before") hostElement.prepend(textSpan);
      else hostElement.append(textSpan);
      const hostRectAfter = hostElement.getBoundingClientRect();
      const hostMoved = [
        hostRectAfter.left - hostRectBefore.left,
        hostRectAfter.top - hostRectBefore.top,
        hostRectAfter.width - hostRectBefore.width,
        hostRectAfter.height - hostRectBefore.height,
      ].some((rectChange) => Math.abs(rectChange) > pageReadingConstants.layoutTolerance);
      if (!hostMoved) continue;
      textSpan.remove();
      hostElement.removeAttribute(pseudoMark);
    }
  }
}
