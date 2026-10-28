import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import {
  convertCssColor,
  describePartStep,
  measureSpaceWidth,
  findStepOwner,
  isElementRotated,
  measureEffectiveOpacity,
  measureElementScale,
  measureRelativeBox,
  pickViewerFont,
  readRunHighlight,
} from "./slide-style-reading.ts";
import type { TextAlignment, TextPart, SlideTextRun } from "./slide-part-types.ts";

// Page functions, see slide-style-reading.ts. A text box gets the lines the browser broke, so PowerPoint keeps them.
type RunStyle = Omit<SlideTextRun, "runContent" | "startsLine"> & { letterCase: string; spaceWidth: number; viewerSpaceWidth: number; highlightOwner?: HTMLElement; boxPadding: number };
// A highlighted box keeps its padding as a space of that width at each end, inside the highlight.
type LineCharacter = { characterText: string; runStyleIndex: number; characterLeft: number; characterRight: number; isBoxPadding?: boolean };
type TextLine = { lineCharacters: LineCharacter[]; lineTop: number; lineBottom: number; lineLeft: number; lineRight: number; lastRight: number; strutMiddle?: number };

export const textPageFunctions = [
  findTextHolder,
  isWrappedText,
  wrapNativeText,
  hasDecorationLine,
  describeRunStyle,
  changeLetterCase,
  readTextAlignment,
  measureVisibleArea,
  measureTextLines,
  trimLineSpaces,
  describeTextRun,
  collectTextRuns,
  splitHangingCharacters,
  readHolderText,
];

function findTextHolder(textNode: Text): HTMLElement | undefined {
  for (let currentElement = textNode.parentElement; currentElement !== null; currentElement = currentElement.parentElement) {
    const elementDisplay = getComputedStyle(currentElement).display;
    if (!elementDisplay.startsWith("inline") && elementDisplay !== "contents") return currentElement;
  }
  return undefined;
}

// A space the line shows is part of it, even alone in its element; whitespace between blocks renders nothing and stays as it is.
function isWrappedText(textNode: Text, pageElement: HTMLElement): boolean {
  if (textNode.parentElement?.closest(`[${pptxPageMarks.wholeElement}], svg`)) return false;
  if (!pageElement.contains(textNode)) return false;
  if (textNode.data.trim() !== "") return true;
  const spaceRange = document.createRange();
  spaceRange.selectNodeContents(textNode);
  return [...spaceRange.getClientRects()].some((spaceRect) => spaceRect.width >= pageReadingConstants.collapsedSpaceWidth);
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
  let highlightOwner: HTMLElement | undefined;
  for (let currentElement = textWrapper.parentElement; currentElement !== null && currentElement !== textHolder; currentElement = currentElement.parentElement) {
    if (!currentElement.hasAttribute(pptxPageMarks.runHighlight)) continue;
    highlightOwner = currentElement;
    break;
  }
  const highlightColor = highlightOwner === undefined ? undefined : readRunHighlight(highlightOwner, pageElement);
  const highlightBox =
    highlightOwner !== undefined && highlightColor !== undefined && highlightColor.colorOpacity < 1
      ? measureRelativeBox(highlightOwner.getBoundingClientRect(), pageElement.getBoundingClientRect())
      : undefined;
  const viewerFont = pickViewerFont(wrapperStyle.fontFamily);
  const fontShorthand = `${wrapperStyle.fontStyle} ${wrapperStyle.fontWeight} ${wrapperStyle.fontSize}`;
  return {
    fontFamily: viewerFont,
    fontSize: Number.parseFloat(wrapperStyle.fontSize) * holderScale,
    isBoldFace: Number.parseInt(wrapperStyle.fontWeight, 10) >= pageReadingConstants.boldFontWeight,
    isItalic: wrapperStyle.fontStyle !== "normal",
    isUnderlined: hasDecorationLine(textWrapper, textHolder, "underline"),
    isStruck: hasDecorationLine(textWrapper, textHolder, "line-through"),
    textColor,
    letterSpacing: (Number.parseFloat(wrapperStyle.letterSpacing) || 0) * holderScale,
    outlineStroke: strokeColor === undefined ? undefined : { strokeColor, strokeWidth: strokeWidth * holderScale, isDashed: false },
    highlightColor,
    highlightBox,
    letterCase: wrapperStyle.textTransform,
    spaceWidth: measureSpaceWidth(`${fontShorthand} ${wrapperStyle.fontFamily}`) * holderScale,
    viewerSpaceWidth: measureSpaceWidth(`${fontShorthand} "${viewerFont}"`) * holderScale,
    highlightOwner,
    boxPadding: highlightOwner === undefined ? 0 : Number.parseFloat(getComputedStyle(highlightOwner).paddingLeft) * holderScale,
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

// What a scrolled or clipped box hides, such as code lines scrolled out of view, stays out of the text box.
function measureVisibleArea(textHolder: HTMLElement, pageElement: HTMLElement): DOMRect {
  const pageRect = pageElement.getBoundingClientRect();
  let [visibleLeft, visibleTop, visibleRight, visibleBottom] = [pageRect.left, pageRect.top, pageRect.right, pageRect.bottom];
  for (let currentElement: HTMLElement | null = textHolder; currentElement !== null && currentElement !== pageElement; currentElement = currentElement.parentElement) {
    const elementStyle = getComputedStyle(currentElement);
    if (elementStyle.overflowX === "visible" && elementStyle.overflowY === "visible") continue;
    const clippingRect = currentElement.getBoundingClientRect();
    [visibleLeft, visibleTop] = [Math.max(visibleLeft, clippingRect.left), Math.max(visibleTop, clippingRect.top)];
    [visibleRight, visibleBottom] = [Math.min(visibleRight, clippingRect.right), Math.min(visibleBottom, clippingRect.bottom)];
  }
  return new DOMRect(visibleLeft, visibleTop, visibleRight - visibleLeft, visibleBottom - visibleTop);
}

// Lines come from where the characters stand: wrapping, <br> and the line breaks of code all show up as a lower line.
function measureTextLines(
  textWrappers: HTMLElement[],
  runStyles: RunStyle[],
  strutFontSize: number,
  textHolder: HTMLElement,
  holderScale: number,
  pageElement: HTMLElement,
  visibleArea: DOMRect,
): TextLine[] {
  const textLines: TextLine[] = [];
  const characterRange = document.createRange();
  for (const textWrapper of textWrappers) {
    const runStyle = describeRunStyle(textWrapper, textHolder, holderScale, pageElement);
    if (runStyle === undefined) continue;
    const runStyleIndex = runStyles.push(runStyle) - 1;
    const ownerWrappers = runStyle.highlightOwner === undefined ? [] : [...runStyle.highlightOwner.querySelectorAll(`[${pptxPageMarks.textWrapper}]`)];
    const paddingStyleIndex = runStyles.push({ ...runStyle, letterSpacing: runStyle.boxPadding - runStyle.viewerSpaceWidth }) - 1;
    const describePadding = (paddingLeft: number): LineCharacter => ({
      characterText: " ",
      runStyleIndex: paddingStyleIndex,
      characterLeft: paddingLeft,
      characterRight: paddingLeft + runStyle.boxPadding,
      isBoxPadding: true,
    });
    let needsLeadingPadding = ownerWrappers[0] === textWrapper;
    let lastPlacedLine: TextLine | undefined;
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
      const characterCentre = (characterRect.left + characterRect.right) / 2;
      if (characterMiddle < visibleArea.top || characterMiddle > visibleArea.bottom || characterCentre < visibleArea.left || characterCentre > visibleArea.right) continue;
      let currentLine = textLines.at(-1);
      if (currentLine === undefined || characterMiddle > currentLine.lineBottom) {
        currentLine = { lineCharacters: [], lineTop: characterRect.top, lineBottom: characterRect.bottom, lineLeft: characterRect.left, lineRight: characterRect.right, lastRight: characterRect.left };
        textLines.push(currentLine);
      }
      if (needsLeadingPadding) {
        currentLine.lineCharacters.push(describePadding(characterRect.left - runStyle.boxPadding));
        currentLine.lineLeft = Math.min(currentLine.lineLeft, characterRect.left - runStyle.boxPadding);
        needsLeadingPadding = false;
      }
      // A gap the text itself does not explain, such as a crumb separator or a code box's padding, becomes spaces.
      const unexplainedGap = characterRect.left - currentLine.lastRight - runStyle.letterSpacing;
      const lastCharacter = currentLine.lineCharacters.at(-1);
      if (!isSpaceCharacter && lastCharacter !== undefined && lastCharacter.characterText.trim() !== "" && unexplainedGap > runStyle.spaceWidth * pageReadingConstants.gapSpaceShare) {
        const gapSpaces = Math.max(1, Math.round(unexplainedGap / runStyle.spaceWidth));
        for (let spacePosition = 0; spacePosition < gapSpaces; spacePosition += 1) {
          currentLine.lineCharacters.push({ characterText: " ", runStyleIndex: lastCharacter.runStyleIndex, characterLeft: currentLine.lastRight, characterRight: characterRect.left });
        }
      }
      currentLine.lastRight = characterRect.right;
      lastPlacedLine = currentLine;
      currentLine.lineCharacters.push({ characterText: changeLetterCase(characterText, runStyle.letterCase), runStyleIndex, characterLeft: characterRect.left, characterRight: characterRect.right });
      currentLine.lineTop = Math.min(currentLine.lineTop, characterRect.top);
      currentLine.lineBottom = Math.max(currentLine.lineBottom, characterRect.bottom);
      if (!isSpaceCharacter) {
        currentLine.lineLeft = Math.min(currentLine.lineLeft, characterRect.left);
        currentLine.lineRight = Math.max(currentLine.lineRight, characterRect.right);
      }
      if (Math.abs(runStyle.fontSize - strutFontSize) < pageReadingConstants.layoutTolerance) currentLine.strutMiddle ??= characterMiddle;
    }
    if (lastPlacedLine !== undefined && ownerWrappers.at(-1) === textWrapper) {
      lastPlacedLine.lineCharacters.push(describePadding(lastPlacedLine.lastRight));
      lastPlacedLine.lineRight = Math.max(lastPlacedLine.lineRight, lastPlacedLine.lastRight + runStyle.boxPadding);
    }
  }
  return textLines;
}

function trimLineSpaces(textLine: TextLine, keepsLeadingSpaces: boolean): LineCharacter[] {
  const lineCharacters = [...textLine.lineCharacters];
  const isTrimmedSpace = (lineCharacter: LineCharacter | undefined) => lineCharacter !== undefined && !lineCharacter.isBoxPadding && lineCharacter.characterText.trim() === "";
  while (isTrimmedSpace(lineCharacters.at(-1))) lineCharacters.pop();
  while (!keepsLeadingSpaces && isTrimmedSpace(lineCharacters[0])) lineCharacters.shift();
  return lineCharacters;
}

function describeTextRun(runStyle: RunStyle, startsLine: boolean): SlideTextRun {
  const { letterCase: _letterCase, spaceWidth: _spaceWidth, viewerSpaceWidth: _viewerSpaceWidth, highlightOwner: _highlightOwner, boxPadding: _boxPadding, ...textStyle } = runStyle;
  return { ...textStyle, runContent: "", startsLine };
}

// Empty lines between two lines of text, as between paragraphs of code, are counted from the distance.
function collectTextRuns(textLines: TextLine[], runStyles: RunStyle[], lineHeight: number, keepsLeadingSpaces: boolean): SlideTextRun[] {
  const textRuns: SlideTextRun[] = [];
  let previousMiddle: number | undefined;
  for (const textLine of textLines) {
    const lineMiddle = textLine.strutMiddle ?? (textLine.lineTop + textLine.lineBottom) / 2;
    const skippedLines = previousMiddle === undefined ? 0 : Math.max(0, Math.round((lineMiddle - previousMiddle) / lineHeight) - 1);
    for (let emptyLine = 0; emptyLine < skippedLines; emptyLine += 1) textRuns.push(describeTextRun(runStyles[0]!, true));
    let currentLineRun: SlideTextRun | undefined;
    let runStyleIndex = -1;
    for (const { characterText, runStyleIndex: characterStyleIndex } of trimLineSpaces(textLine, keepsLeadingSpaces)) {
      if (currentLineRun === undefined || characterStyleIndex !== runStyleIndex) {
        currentLineRun = describeTextRun(runStyles[characterStyleIndex]!, currentLineRun === undefined && previousMiddle !== undefined);
        runStyleIndex = characterStyleIndex;
        textRuns.push(currentLineRun);
      }
      currentLineRun.runContent += characterText;
    }
    previousMiddle = lineMiddle;
  }
  return textRuns;
}

// A mark hanging left of a left-aligned text, as an opening quote, gets its own box ending where the text starts:
// one text box would push every other line out by the width of the mark.
function splitHangingCharacters(textLine: TextLine, contentLeft: number): LineCharacter[] {
  const hangingCount = textLine.lineCharacters.findIndex((lineCharacter) => lineCharacter.characterRight > contentLeft + pageReadingConstants.layoutTolerance);
  if (hangingCount <= 0) return [];
  const hangingCharacters = textLine.lineCharacters.splice(0, hangingCount);
  const visibleCharacters = textLine.lineCharacters.filter((lineCharacter) => lineCharacter.isBoxPadding || lineCharacter.characterText.trim() !== "");
  textLine.lineLeft = Math.min(...visibleCharacters.map((lineCharacter) => lineCharacter.characterLeft), contentLeft);
  return hangingCharacters;
}

// A text holder whose text belongs to different steps splits into one box per step: PowerPoint animates whole paragraphs.
export function readHolderText(textHolder: HTMLElement, textWrappers: HTMLElement[], pageElement: HTMLElement): TextPart[] {
  const pageRect = pageElement.getBoundingClientRect();
  const holderStyle = getComputedStyle(textHolder);
  const holderScale = measureElementScale(textHolder);
  const strutFontSize = Number.parseFloat(holderStyle.fontSize) * holderScale;
  const keepsLeadingSpaces = /^(pre|pre-wrap|break-spaces)$/.test(holderStyle.whiteSpace);
  const visibleArea = measureVisibleArea(textHolder, pageElement);
  const textAlignment = readTextAlignment(holderStyle.textAlign);
  const contentLeft = textHolder.getBoundingClientRect().left + (Number.parseFloat(holderStyle.borderLeftWidth) + Number.parseFloat(holderStyle.paddingLeft)) * holderScale;
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
    const textLines = measureTextLines(groupWrappers, runStyles, strutFontSize, textHolder, holderScale, pageElement, visibleArea);
    const [firstLine] = textLines;
    const lastLine = textLines.at(-1);
    if (firstLine === undefined || lastLine === undefined) continue;
    const lineHeight = holderStyle.lineHeight === "normal" ? firstLine.lineBottom - firstLine.lineTop : Number.parseFloat(holderStyle.lineHeight) * holderScale;
    const hangingCharacters = textAlignment === "left" || textAlignment === "justify" ? splitHangingCharacters(firstLine, contentLeft) : [];
    const textRuns = collectTextRuns(textLines, runStyles, lineHeight, keepsLeadingSpaces);
    if (textRuns.every((slideTextRun) => slideTextRun.runContent === "")) continue;
    const upperBoxEdge = (firstLine.strutMiddle ?? (firstLine.lineTop + firstLine.lineBottom) / 2) - lineHeight / 2;
    const partStep = describePartStep(stepOwner);
    if (hangingCharacters.length > 0) {
      const hangingLeft = hangingCharacters[0]!.characterLeft;
      textParts.push({
        partKind: "text",
        ...partStep,
        leftEdge: hangingLeft - pageRect.left,
        upperEdge: upperBoxEdge - pageRect.top,
        boxWidth: firstLine.lineLeft - hangingLeft,
        boxHeight: lineHeight,
        textRuns: collectTextRuns([{ ...firstLine, lineCharacters: hangingCharacters }], runStyles, lineHeight, true),
        textAlignment: "right",
        lineHeight,
        lineCount: 1,
      });
    }
    const boxBottom = (lastLine.strutMiddle ?? (lastLine.lineTop + lastLine.lineBottom) / 2) + lineHeight / 2;
    const leftmostEdge = Math.min(...textLines.map((textLine) => textLine.lineLeft));
    const boxRight = Math.max(...textLines.map((textLine) => textLine.lineRight));
    textParts.push({
      partKind: "text",
      ...partStep,
      leftEdge: leftmostEdge - pageRect.left,
      upperEdge: upperBoxEdge - pageRect.top,
      boxWidth: boxRight - leftmostEdge,
      boxHeight: boxBottom - upperBoxEdge,
      textRuns,
      textAlignment,
      lineHeight,
      lineCount: textRuns.filter((slideTextRun) => slideTextRun.startsLine).length + 1,
    });
  }
  return textParts;
}
