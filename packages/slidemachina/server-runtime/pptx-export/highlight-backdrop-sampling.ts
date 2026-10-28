import sharp from "sharp";
import { pageReadingConstants, pptxPageMarks } from "./pptx-page-marks.ts";
import type { Page } from "playwright-core";
import type { SlideLayout, SlideTextRun } from "./slide-part-types.ts";

type PageCorner = { pageLeft: number; pageTop: number };

const colorChannelCount = 3;
const hexadecimalPairLength = 2;
const smallestClipSide = 1;

function readColorChannels(colorHex: string): number[] {
  return Array.from({ length: colorChannelCount }, (_unusedValue, channelIndex) => Number.parseInt(colorHex.slice(channelIndex * hexadecimalPairLength, (channelIndex + 1) * hexadecimalPairLength), pageReadingConstants.hexadecimalBase));
}

function writeColorHex(colorChannels: number[]): string {
  return colorChannels.map((colorChannel) => Math.round(colorChannel).toString(pageReadingConstants.hexadecimalBase).padStart(hexadecimalPairLength, "0")).join("");
}

async function measureAverageBackdrop(exportPage: Page, pageCorner: PageCorner, highlightedRun: SlideTextRun): Promise<number[]> {
  const { leftEdge, upperEdge, boxWidth, boxHeight } = highlightedRun.highlightBox!;
  const backdropBytes = await exportPage.screenshot({
    clip: { x: pageCorner.pageLeft + leftEdge, y: pageCorner.pageTop + upperEdge, width: Math.max(smallestClipSide, boxWidth), height: Math.max(smallestClipSide, boxHeight) },
    scale: "css",
  });
  const { channels: channelStatistics } = await sharp(backdropBytes).stats();
  return channelStatistics.slice(0, colorChannelCount).map((channelStatistic) => channelStatistic.mean);
}

// A translucent code box over a picture becomes a solid highlight: its colour over the average of the pixels under it, with every plate hidden.
export async function blendHighlightsOverPixels(exportPage: Page, pageIndex: number, slideLayout: SlideLayout): Promise<void> {
  const highlightedRuns = slideLayout.slideParts.flatMap((slidePart) => (slidePart.partKind === "text" ? slidePart.textRuns : [])).filter((textRun) => textRun.highlightBox !== undefined);
  if (highlightedRuns.length === 0) return;
  const highlightSelector = `[${pptxPageMarks.runHighlight}]`;
  const pageCorner = await exportPage.evaluate<PageCorner, [number, string]>(
    ([shownPageIndex, plateSelector]) => {
      const pageElement = document.querySelectorAll<HTMLElement>("[data-print-page]")[shownPageIndex]!;
      for (const plateElement of pageElement.querySelectorAll<HTMLElement>(plateSelector)) plateElement.style.visibility = "hidden";
      pageElement.scrollIntoView({ block: "start", inline: "start" });
      const pageRect = pageElement.getBoundingClientRect();
      return { pageLeft: pageRect.left, pageTop: pageRect.top };
    },
    [pageIndex, highlightSelector],
  );
  try {
    for (const highlightedRun of highlightedRuns) {
      const plateColor = highlightedRun.highlightColor!;
      const backdropChannels = await measureAverageBackdrop(exportPage, pageCorner, highlightedRun);
      const blendedChannels = readColorChannels(plateColor.colorHex).map(
        (plateChannel, channelIndex) => plateChannel * plateColor.colorOpacity + backdropChannels[channelIndex]! * (1 - plateColor.colorOpacity),
      );
      highlightedRun.highlightColor = { colorHex: writeColorHex(blendedChannels), colorOpacity: 1 };
      delete highlightedRun.highlightBox;
    }
  } finally {
    await exportPage.evaluate<void, [number, string]>(
      ([shownPageIndex, plateSelector]) => {
        for (const plateElement of document.querySelectorAll<HTMLElement>("[data-print-page]")[shownPageIndex]!.querySelectorAll<HTMLElement>(plateSelector)) plateElement.style.visibility = "";
      },
      [pageIndex, highlightSelector],
    );
  }
}
