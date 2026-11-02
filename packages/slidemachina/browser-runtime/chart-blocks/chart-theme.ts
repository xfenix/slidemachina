const chartPaletteSize = 6;
const paletteNumberOffset = 1;
const fallbackChartTextSize = 24;
const fallbackTooltipCornerRadius = 12;
export type ChartThemeValues = {
  seriesPalette: string[];
  textFontFamily: string;
  textSize: number;
  mutedColor: string;
  axisColor: string;
  gridColor: string;
  tooltipBackgroundColor: string;
  tooltipTextColor: string;
  tooltipMutedColor: string;
  tooltipCornerRadius: number;
};

// Computed styles resolve var() and oklch() in the slide tone, so the probe element sits inside the slide.
function probeComputedStyles(probeElement: HTMLElement, styleAssignments: Record<string, string>): Record<string, string> {
  const inlineStyles = probeElement.style as unknown as Record<string, string>;
  for (const [styleName, styleValue] of Object.entries(styleAssignments)) {
    inlineStyles[styleName] = styleValue;
  }
  const computedStyles = getComputedStyle(probeElement) as unknown as Record<string, string>;
  const resolvedStyles: Record<string, string> = {};
  for (const styleName of Object.keys(styleAssignments)) {
    resolvedStyles[styleName] = computedStyles[styleName] ?? "";
  }
  for (const styleName of Object.keys(styleAssignments)) {
    inlineStyles[styleName] = "";
  }
  return resolvedStyles;
}

export function readChartTheme(probeElement: HTMLElement): ChartThemeValues {
  const baseStyles = probeComputedStyles(probeElement, {
    color: "var(--muted-color)",
    borderTopColor: "var(--chart-axis-color)",
    borderRightColor: "var(--chart-grid-color)",
    backgroundColor: "var(--chart-tooltip-background)",
    fontFamily: "var(--font-text)",
    fontSize: "var(--chart-text-size)",
  });
  const tooltipStyles = probeComputedStyles(probeElement, {
    color: "var(--chart-tooltip-text-color)",
    borderTopColor: "var(--chart-tooltip-muted-color)",
    borderTopLeftRadius: "var(--chart-tooltip-radius)",
  });
  const seriesPalette = Array.from({ length: chartPaletteSize }, (_unusedEntry, seriesIndex) =>
    probeComputedStyles(probeElement, { color: `var(--chart-series-${seriesIndex + paletteNumberOffset}-color)` }).color ?? "",
  );
  const parsedTextSize = Number.parseFloat(baseStyles.fontSize ?? "");
  const parsedTooltipCornerRadius = Number.parseFloat(tooltipStyles.borderTopLeftRadius ?? "");
  return {
    seriesPalette,
    textFontFamily: baseStyles.fontFamily ?? "",
    textSize: Number.isFinite(parsedTextSize) ? parsedTextSize : fallbackChartTextSize,
    mutedColor: baseStyles.color ?? "",
    axisColor: baseStyles.borderTopColor ?? "",
    gridColor: baseStyles.borderRightColor ?? "",
    tooltipBackgroundColor: baseStyles.backgroundColor ?? "",
    tooltipTextColor: tooltipStyles.color ?? "",
    tooltipMutedColor: tooltipStyles.borderTopColor ?? "",
    tooltipCornerRadius: Number.isFinite(parsedTooltipCornerRadius) ? parsedTooltipCornerRadius : fallbackTooltipCornerRadius,
  };
}

export function compareChartThemes(firstTheme: ChartThemeValues | null, secondTheme: ChartThemeValues): boolean {
  if (firstTheme === null) return false;
  return (
    firstTheme.textFontFamily === secondTheme.textFontFamily &&
    firstTheme.textSize === secondTheme.textSize &&
    firstTheme.mutedColor === secondTheme.mutedColor &&
    firstTheme.axisColor === secondTheme.axisColor &&
    firstTheme.gridColor === secondTheme.gridColor &&
    firstTheme.tooltipBackgroundColor === secondTheme.tooltipBackgroundColor &&
    firstTheme.tooltipTextColor === secondTheme.tooltipTextColor &&
    firstTheme.tooltipMutedColor === secondTheme.tooltipMutedColor &&
    firstTheme.tooltipCornerRadius === secondTheme.tooltipCornerRadius &&
    firstTheme.seriesPalette.length === secondTheme.seriesPalette.length &&
    firstTheme.seriesPalette.every((seriesColor, seriesIndex) => seriesColor === secondTheme.seriesPalette[seriesIndex])
  );
}
