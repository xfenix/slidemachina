import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  Pie,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadialBar,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const chartPaletteSize = 6;
const fallbackChartTextSize = 24;
const fallbackTooltipCornerRadius = 12;
const seriesStrokeWidth = 3;
const activeDotRadius = 6;
const areaFillShare = 0.14;
const barCornerRadius = 8;
const animationsPlayOnMount = false;
const tooltipHorizontalPadding = 16;
const tooltipVerticalPadding = 12;
const tooltipLabelGap = 8;
const tooltipShadowOpacity = 0.25;
const tooltipShadowOffset = 10;
const tooltipShadowBlur = 30;
const axisElementTypes: unknown[] = [XAxis, YAxis, ZAxis, PolarAngleAxis, PolarRadiusAxis];
const seriesElementTypes: unknown[] = [Line, Area, Bar, Scatter, Radar, RadialBar, Pie];

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

type PaletteState = { nextSeriesIndex: number };

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
    probeComputedStyles(probeElement, { color: `var(--chart-series-${seriesIndex + 1}-color)` }).color ?? "",
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

export function themeChartChildren(chartChildren: ReactNode, chartTheme: ChartThemeValues): ReactNode {
  return themeChildList(chartChildren, chartTheme, { nextSeriesIndex: 0 });
}

function themeChildList(chartChildren: ReactNode, chartTheme: ChartThemeValues, paletteState: PaletteState): ReactNode {
  return Children.map(chartChildren, (chartChild) => (isValidElement(chartChild) ? themeSingleChild(chartChild, chartTheme, paletteState) : chartChild));
}

function themeSingleChild(chartChild: ReactElement, chartTheme: ChartThemeValues, paletteState: PaletteState): ReactElement {
  const childType = chartChild.type;
  if (childType === CartesianGrid || childType === PolarGrid) {
    return applyDefaultProps(chartChild, { stroke: chartTheme.gridColor, vertical: false });
  }
  if (axisElementTypes.includes(childType)) {
    return applyDefaultProps(chartChild, {
      stroke: chartTheme.axisColor,
      tickLine: false,
      axisLine: { stroke: chartTheme.axisColor },
      tick: { fill: chartTheme.mutedColor, fontSize: chartTheme.textSize, fontFamily: chartTheme.textFontFamily },
    });
  }
  if (childType === Tooltip) {
    return applyDefaultProps(chartChild, buildTooltipDefaults(chartTheme));
  }
  if (childType === Legend) {
    return applyDefaultProps(chartChild, { wrapperStyle: { color: chartTheme.mutedColor, fontSize: chartTheme.textSize, fontFamily: chartTheme.textFontFamily } });
  }
  if (childType === LabelList) {
    return applyDefaultProps(chartChild, { fill: chartTheme.mutedColor, fontSize: chartTheme.textSize });
  }
  if (childType === Cell) {
    return chartChild;
  }
  if (seriesElementTypes.includes(childType)) {
    return themeSeriesElement(chartChild, chartTheme, paletteState);
  }
  return cloneElement(chartChild as ReactElement<{ children?: ReactNode }>, {}, themeChildList((chartChild.props as { children?: ReactNode }).children, chartTheme, paletteState));
}

function themeSeriesElement(seriesElement: ReactElement, chartTheme: ChartThemeValues, paletteState: PaletteState): ReactElement {
  const seriesColor = chartTheme.seriesPalette[paletteState.nextSeriesIndex % chartTheme.seriesPalette.length]!;
  paletteState.nextSeriesIndex += 1;
  const childType = seriesElement.type;
  let seriesDefaults: Record<string, unknown> = {};
  if (childType === Line) {
    seriesDefaults = { stroke: seriesColor, strokeWidth: seriesStrokeWidth, type: "monotone", dot: false, activeDot: { r: activeDotRadius, strokeWidth: 0 }, isAnimationActive: animationsPlayOnMount };
  } else if (childType === Area) {
    seriesDefaults = { stroke: seriesColor, fill: seriesColor, fillOpacity: areaFillShare, strokeWidth: seriesStrokeWidth, type: "monotone", isAnimationActive: animationsPlayOnMount };
  } else if (childType === Bar) {
    seriesDefaults = { fill: seriesColor, radius: [barCornerRadius, barCornerRadius, 0, 0], isAnimationActive: animationsPlayOnMount };
  } else if (childType === Scatter) {
    seriesDefaults = { fill: seriesColor, isAnimationActive: animationsPlayOnMount };
  } else if (childType === Radar) {
    seriesDefaults = { stroke: seriesColor, fill: seriesColor, fillOpacity: areaFillShare, isAnimationActive: animationsPlayOnMount };
  } else if (childType === RadialBar) {
    seriesDefaults = { fill: seriesColor, isAnimationActive: animationsPlayOnMount };
  } else if (childType === Pie) {
    seriesDefaults = { isAnimationActive: animationsPlayOnMount };
  }
  const themedElement = applyDefaultProps(seriesElement, seriesDefaults);
  if (childType === Pie && (themedElement.props as { fill?: string }).fill === undefined) {
    return cloneElement(themedElement as ReactElement<{ children?: ReactNode }>, {}, themePieCells((themedElement.props as { children?: ReactNode }).children, chartTheme));
  }
  return themedElement;
}

// Pie slices take their colours from Cells in order; a Pie without Cells keeps its own fill.
function themePieCells(pieCells: ReactNode, chartTheme: ChartThemeValues): ReactNode {
  let pieCellIndex = 0;
  return Children.map(pieCells, (pieCell) => {
    if (!isValidElement(pieCell) || pieCell.type !== Cell) {
      return pieCell;
    }
    const cellColor = chartTheme.seriesPalette[pieCellIndex % chartTheme.seriesPalette.length]!;
    pieCellIndex += 1;
    return applyDefaultProps(pieCell, { fill: cellColor });
  });
}

function buildTooltipDefaults(chartTheme: ChartThemeValues): Record<string, unknown> {
  return {
    contentStyle: {
      backgroundColor: chartTheme.tooltipBackgroundColor,
      border: "none",
      borderRadius: chartTheme.tooltipCornerRadius,
      boxShadow: `0 ${tooltipShadowOffset}px ${tooltipShadowBlur}px rgb(0 0 0 / ${tooltipShadowOpacity})`,
      color: chartTheme.tooltipTextColor,
      fontFamily: chartTheme.textFontFamily,
      fontSize: chartTheme.textSize,
      padding: `${tooltipVerticalPadding}px ${tooltipHorizontalPadding}px`,
    },
    labelStyle: { color: chartTheme.tooltipMutedColor, marginBottom: tooltipLabelGap },
    itemStyle: { color: chartTheme.tooltipTextColor },
  };
}

// A prop the author set wins over the theme; defaults fill only the unset ones.
function applyDefaultProps(chartElement: ReactElement, defaultProps: Record<string, unknown>): ReactElement {
  const elementProps = chartElement.props as Record<string, unknown>;
  const missingProps = Object.fromEntries(Object.entries(defaultProps).filter(([propName]) => elementProps[propName] === undefined));
  return Object.keys(missingProps).length > 0 ? cloneElement(chartElement as ReactElement<Record<string, unknown>>, missingProps) : chartElement;
}
