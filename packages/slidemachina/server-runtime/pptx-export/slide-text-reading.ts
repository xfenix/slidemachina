import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import { convertCssColor, describePartStep, measureSpaceWidth, findStepOwner, isElementRotated, measureEffectiveOpacity, measureElementScale } from "./slide-style-reading.ts";
import type { TextAlignment, TextPart, SlideTextRun } from "./slide-part-types.ts";

// Page functions, see slide-style-reading.ts. A text box gets the lines the browser broke, so PowerPoint keeps them.
type RunStyle = Omit<SlideTextRun, "runContent" | "startsLine"> & { letterCase: string; spaceWidth: number };
type LineCharacter = { characterText: string; runStyleIndex: number };
type TextLine = { lineCharacters: LineCharacter[]; lineTop: number; lineBottom: number; lineLeft: number; lineRight: number; lastRight: number; strutMiddle?: number };

export const textPageFunctions = [
  findTextHolder,
  isInlineNeighbour,
  isWrappedText,
  wrapNativeText,
  hasDecorationLine,
  describeRunStyle,
  changeLetterCase,
  readTextAlignment,
  measureTextLines,
  trimLineSpaces,
  collectTextRuns,
  readHolderText,
];

function findTextHolder(textNode: Text): HTMLElement | undefined {
  for (let currentElement = textNode.parentElement; currentElement !== null; currentElement = currentElement.parentElement) {
    const elementDisplay = getComputedStyle(currentElement).display;
    if (!elementDisplay.startsWith("inline") && elementDisplay !== "contents") return currentElement;
  }
  return undefined;
}

function isInlineNeighbour(neighbourNode: Node | null): boolean {
  if (neighbourNode === null) return false;
  if (neighbourNode instanceof Text) return true;
  return neighbourNode instanceof Element && getComputedStyle(neighbourNode).display.startsWith("inline");
}

// A space between two inline elements is part of the line; whitespace between blocks renders nothing and stays as it is.
function isWrappedText(textNode: Text, pageElement: HTMLElement): boolean {
  if (textNode.parentElement?.closest(`[${pptxPageMarks.wholeElement}], svg`)) return false;
  if (!pageElement.contains(textNode)) return false;
  if (textNode.data.trim() !== "") return true;
  return isInlineNeighbour(textNode.previousSibling) && isInlineNeighbour(textNode.nextSibling);
}

// Wraps the text a native text box will show, so the picture of the slide can hide it. A block that moved after wrapping keeps its text in the picture.
export function wrapNativeText(pageElement: HTMLElement): Map<HTMLElement, HTMLElement[]> {
  const textWalker = document.createTreeWalker(pageElement, NodeFilter.SHOW_TEXT);
  const textNodesByHolder = new Map<HTMLElement, Text[]>();
  for (let textNode = textWalker.nextNode() as Text | null; textNode !== null; textNode = textWalker.nextNode() as Text | null) {
    if (!isWrappedText(textNode, pageElement)) continue;
    const textHolder = findTextHolder(textNode);
    if (textHolder === undefined || !pageElement.contains(textHolder) || isElementRotated(textHolder, pageElement)) continue;
    textNodesByHolder.set(textHolder, [...(textNodesByHolder.get(textHolder) ?? []), textNode]);
  }
  const wrappersByHolder = new Map<HTMLElement, HTMLElement[]>();
  for (const [textHolder, textNodes] of textNodesByHolder) {
    const holderRectBefore = textHolder.getBoundingClientRect();
    const textWrappers = textNodes.map((textNode) => {
      const textWrapper = document.createElement("span");
      textWrapper.setAttribute(pptxPageMarks.textWrapper, "");
      textNode.replaceWith(textWrapper);
      textWrapper.append(textNode);
      return textWrapper;
    });
    const holderRectAfter = textHolder.getBoundingClientRect();
    const holderMoved = [
      holderRectAfter.left - holderRectBefore.left,
      holderRectAfter.top - holderRectBefore.top,
      holderRectAfter.width - holderRectBefore.width,
      holderRectAfter.height - holderRectBefore.height,
    ].some((rectChange) => Math.abs(rectChange) > pageReadingConstants.layoutTolerance);
    if (holderMoved) {
      for (const textWrapper of textWrappers) textWrapper.replaceWith(...textWrapper.childNodes);
      continue;
    }
    wrappersByHolder.set(textHolder, textWrappers);
  }
  return wrappersByHolder;
}

function hasDecorationLine(textWrapper: HTMLElement, textHolder: HTMLElement, decorationName: string): boolean {
  for (let currentElement: HTMLElement | null = textWrapper; currentElement !== null; currentElement = currentElement.parentElement) {
    if (getComputedStyle(currentElement).textDecorationLine.includes(decorationName)) return true;
    if (currentElement === textHolder) return false;
  }
  return false;
}

function describeRunStyle(textWrapper: HTMLElement, textHolder: HTMLElement, holderScale: number, pageElement: HTMLElement): RunStyle | undefined {
  const wrapperStyle = getComputedStyle(textWrapper);
  if (wrapperStyle.visibility !== "visible") return undefined;
  const effectiveOpacity = measureEffectiveOpacity(textWrapper, pageElement);
  const textColor = convertCssColor(wrapperStyle.getPropertyValue("-webkit-text-fill-color") || wrapperStyle.color, effectiveOpacity);
  if (textColor === undefined) return undefined;
  const strokeWidth = Number.parseFloat(wrapperStyle.getPropertyValue("-webkit-text-stroke-width")) || 0;
  const strokeColor = strokeWidth > 0 ? convertCssColor(wrapperStyle.getPropertyValue("-webkit-text-stroke-color"), effectiveOpacity) : undefined;
  return {
    fontFamily: wrapperStyle.fontFamily.split(",")[0]!.trim().replaceAll(/^["']|["']$/g, "").replace(/ Variable$/, ""),
    fontSize: Number.parseFloat(wrapperStyle.fontSize) * holderScale,
    isBoldFace: Number.parseInt(wrapperStyle.fontWeight, 10) >= pageReadingConstants.boldFontWeight,
    isItalic: wrapperStyle.fontStyle !== "normal",
    isUnderlined: hasDecorationLine(textWrapper, textHolder, "underline"),
    isStruck: hasDecorationLine(textWrapper, textHolder, "line-through"),
    textColor,
    letterSpacing: (Number.parseFloat(wrapperStyle.letterSpacing) || 0) * holderScale,
    outlineStroke: strokeColor === undefined ? undefined : { strokeColor, strokeWidth: strokeWidth * holderScale, isDashed: false },
    letterCase: wrapperStyle.textTransform,
    spaceWidth: measureSpaceWidth(`${wrapperStyle.fontStyle} ${wrapperStyle.fontWeight} ${wrapperStyle.fontSize} ${wrapperStyle.fontFamily}`) * holderScale,
  };
}

function changeLetterCase(characterText: string, letterCase: string): string {
  if (letterCase === "uppercase") return characterText.toUpperCase();
  if (letterCase === "lowercase") return characterText.toLowerCase();
  return characterText;
}

function readTextAlignment(alignmentValue: string): TextAlignment {
  if (alignmentValue === "center" || alignmentValue === "-webkit-center") return "center";
  if (alignmentValue === "right" || alignmentValue === "end" || alignmentValue === "-webkit-right") return "right";
  if (alignmentValue === "justify") return "justify";
  return "left";
}

// Lines come from where the characters stand: wrapping, <br> and the line breaks of code all show up as a lower line.
function measureTextLines(textWrappers: HTMLElement[], runStyles: RunStyle[], strutFontSize: number, textHolder: HTMLElement, holderScale: number, pageElement: HTMLElement): TextLine[] {
  const textLines: TextLine[] = [];
  const characterRange = document.createRange();
  for (const textWrapper of textWrappers) {
    const runStyle = describeRunStyle(textWrapper, textHolder, holderScale, pageElement);
    if (runStyle === undefined) continue;
    const runStyleIndex = runStyles.push(runStyle) - 1;
    const textNode = textWrapper.firstChild as Text;
    for (let characterOffset = 0; characterOffset < textNode.data.length; ) {
      const characterLength = textNode.data.codePointAt(characterOffset)! > pageReadingConstants.largestSingleUnitCode ? 2 : 1;
      const characterText = textNode.data.slice(characterOffset, characterOffset + characterLength);
      characterRange.setStart(textNode, characterOffset);
      characterRange.setEnd(textNode, characterOffset + characterLength);
      characterOffset += characterLength;
      const characterRect = [...characterRange.getClientRects()].find((clientRect) => clientRect.height > 0);
      const isSpaceCharacter = characterText.trim() === "";
      if (characterRect === undefined || characterText === "\n" || (isSpaceCharacter && characterRect.width < pageReadingConstants.collapsedSpaceWidth)) continue;
      const characterMiddle = (characterRect.top + characterRect.bottom) / 2;
      let currentLine = textLines.at(-1);
      if (currentLine === undefined || characterMiddle > currentLine.lineBottom) {
        currentLine = { lineCharacters: [], lineTop: characterRect.top, lineBottom: characterRect.bottom, lineLeft: characterRect.left, lineRight: characterRect.right, lastRight: characterRect.left };
        textLines.push(currentLine);
      }
      // A gap the text itself does not explain, such as a crumb separator or a code box's padding, becomes spaces.
      const unexplainedGap = characterRect.left - currentLine.lastRight - runStyle.letterSpacing;
      const lastCharacter = currentLine.lineCharacters.at(-1);
      if (!isSpaceCharacter && lastCharacter !== undefined && lastCharacter.characterText.trim() !== "" && unexplainedGap > runStyle.spaceWidth * pageReadingConstants.gapSpaceShare) {
        const gapSpaces = Math.max(1, Math.round(unexplainedGap / runStyle.spaceWidth));
        for (let spacePosition = 0; spacePosition < gapSpaces; spacePosition += 1) currentLine.lineCharacters.push({ characterText: " ", runStyleIndex: lastCharacter.runStyleIndex });
      }
      currentLine.lastRight = characterRect.right;
      currentLine.lineCharacters.push({ characterText: changeLetterCase(characterText, runStyle.letterCase), runStyleIndex });
      currentLine.lineTop = Math.min(currentLine.lineTop, characterRect.top);
      currentLine.lineBottom = Math.max(currentLine.lineBottom, characterRect.bottom);
      if (!isSpaceCharacter) {
        currentLine.lineLeft = Math.min(currentLine.lineLeft, characterRect.left);
        currentLine.lineRight = Math.max(currentLine.lineRight, characterRect.right);
      }
      if (Math.abs(runStyle.fontSize - strutFontSize) < pageReadingConstants.layoutTolerance) currentLine.strutMiddle ??= characterMiddle;
    }
  }
  return textLines;
}

function trimLineSpaces(textLine: TextLine, keepsLeadingSpaces: boolean): LineCharacter[] {
  const lineCharacters = [...textLine.lineCharacters];
  while (lineCharacters.at(-1)?.characterText.trim() === "") lineCharacters.pop();
  while (!keepsLeadingSpaces && lineCharacters[0]?.characterText.trim() === "") lineCharacters.shift();
  return lineCharacters;
}

// Empty lines between two lines of text, as between paragraphs of code, are counted from the distance.
function collectTextRuns(textLines: TextLine[], runStyles: RunStyle[], lineHeight: number, keepsLeadingSpaces: boolean): SlideTextRun[] {
  const textRuns: SlideTextRun[] = [];
  let previousMiddle: number | undefined;
  for (const textLine of textLines) {
    const lineMiddle = textLine.strutMiddle ?? (textLine.lineTop + textLine.lineBottom) / 2;
    const skippedLines = previousMiddle === undefined ? 0 : Math.max(0, Math.round((lineMiddle - previousMiddle) / lineHeight) - 1);
    for (let emptyLine = 0; emptyLine < skippedLines; emptyLine += 1) textRuns.push({ ...runStyles[0]!, runContent: "", startsLine: true });
    let currentLineRun: SlideTextRun | undefined;
    let runStyleIndex = -1;
    for (const { characterText, runStyleIndex: characterStyleIndex } of trimLineSpaces(textLine, keepsLeadingSpaces)) {
      if (currentLineRun === undefined || characterStyleIndex !== runStyleIndex) {
        const { letterCase: _letterCase, spaceWidth: _spaceWidth, ...runStyle } = runStyles[characterStyleIndex]!;
        currentLineRun = { ...runStyle, runContent: "", startsLine: currentLineRun === undefined && previousMiddle !== undefined };
        runStyleIndex = characterStyleIndex;
        textRuns.push(currentLineRun);
      }
      currentLineRun.runContent += characterText;
    }
    previousMiddle = lineMiddle;
  }
  return textRuns;
}

// A text holder whose text belongs to different steps splits into one box per step: PowerPoint animates whole paragraphs.
export function readHolderText(textHolder: HTMLElement, textWrappers: HTMLElement[], pageElement: HTMLElement): TextPart[] {
  const pageRect = pageElement.getBoundingClientRect();
  const holderStyle = getComputedStyle(textHolder);
  const holderScale = measureElementScale(textHolder);
  const strutFontSize = Number.parseFloat(holderStyle.fontSize) * holderScale;
  const keepsLeadingSpaces = /^(pre|pre-wrap|break-spaces)$/.test(holderStyle.whiteSpace);
  const wrapperGroups: { stepOwner: HTMLElement | undefined; groupWrappers: HTMLElement[] }[] = [];
  for (const textWrapper of textWrappers) {
    const stepOwner = findStepOwner(textWrapper, pageElement);
    const lastGroup = wrapperGroups.at(-1);
    if (lastGroup !== undefined && lastGroup.stepOwner === stepOwner) lastGroup.groupWrappers.push(textWrapper);
    else wrapperGroups.push({ stepOwner, groupWrappers: [textWrapper] });
  }
  const textParts: TextPart[] = [];
  for (const { stepOwner, groupWrappers } of wrapperGroups) {
    const runStyles: RunStyle[] = [];
    const textLines = measureTextLines(groupWrappers, runStyles, strutFontSize, textHolder, holderScale, pageElement);
    const [firstLine] = textLines;
    const lastLine = textLines.at(-1);
    if (firstLine === undefined || lastLine === undefined) continue;
    const lineHeight = holderStyle.lineHeight === "normal" ? firstLine.lineBottom - firstLine.lineTop : Number.parseFloat(holderStyle.lineHeight) * holderScale;
    const textRuns = collectTextRuns(textLines, runStyles, lineHeight, keepsLeadingSpaces);
    if (textRuns.every((slideTextRun) => slideTextRun.runContent === "")) continue;
    const upperBoxEdge = (firstLine.strutMiddle ?? (firstLine.lineTop + firstLine.lineBottom) / 2) - lineHeight / 2;
    const boxBottom = (lastLine.strutMiddle ?? (lastLine.lineTop + lastLine.lineBottom) / 2) + lineHeight / 2;
    const leftmostEdge = Math.min(...textLines.map((textLine) => textLine.lineLeft));
    const boxRight = Math.max(...textLines.map((textLine) => textLine.lineRight));
    textParts.push({
      partKind: "text",
      ...describePartStep(stepOwner),
      leftEdge: leftmostEdge - pageRect.left,
      upperEdge: upperBoxEdge - pageRect.top,
      boxWidth: boxRight - leftmostEdge,
      boxHeight: boxBottom - upperBoxEdge,
      textRuns,
      textAlignment: readTextAlignment(holderStyle.textAlign),
      lineHeight,
      lineCount: textRuns.filter((slideTextRun) => slideTextRun.startsLine).length + 1,
    });
  }
  return textParts;
}
