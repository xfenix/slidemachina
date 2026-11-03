import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Area, Bar, CartesianGrid, Cell, LabelList, Legend, Line, Pie, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadialBar, Scatter, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { ChartThemeValues } from "./chart-theme.ts";

const chartMargins = { top: 5, right: 5, bottom: 5, left: 0 };
const axisTickMargin = 2;
const axisTickLength = 6;
const horizontalLabelLineHeight = 1.2;
const firstPaletteIndex = 0;
const paletteIndexIncrement = 1;
const seriesStrokeWidth = 3;
const activeDotRadius = 6;
const activeDotStrokeWidth = 0;
const areaFillShare = 0.14;
const barCornerRadius = 8;
const squareCornerRadius = 0;
const tooltipHorizontalPadding = 16;
const tooltipVerticalPadding = 12;
const tooltipLabelGap = 8;
const tooltipShadowOpacity = 0.25;
const tooltipShadowHorizontalOffset = 0;
const tooltipShadowOffset = 10;
const tooltipShadowBlur = 30;
const axisElementTypes: unknown[] = [XAxis, YAxis, ZAxis, PolarAngleAxis, PolarRadiusAxis];
const seriesElementTypes: unknown[] = [Line, Area, Bar, Scatter, Radar, RadialBar, Pie];
type ChartThemingState = { nextSeriesIndex: number; axisLabelWidth?: number };

export function themeChartChildren(chartElement: ReactElement, chartTheme: ChartThemeValues, axisLabelWidth?: number): ReactNode {
  const themedChart = applyDefaultProps(chartElement, { margin: chartMargins });
  return themeChildList(themedChart, chartTheme, { nextSeriesIndex: firstPaletteIndex, axisLabelWidth });
}

function themeChildList(chartChildren: ReactNode, chartTheme: ChartThemeValues, themingState: ChartThemingState): ReactNode {
  return Children.map(chartChildren, (chartChild) => (isValidElement(chartChild) ? themeSingleChild(chartChild, chartTheme, themingState) : chartChild));
}

function themeSingleChild(chartChild: ReactElement, chartTheme: ChartThemeValues, themingState: ChartThemingState): ReactElement {
  const childType = chartChild.type;
  if (childType === CartesianGrid || childType === PolarGrid) {
    return applyDefaultProps(chartChild, { stroke: chartTheme.gridColor, vertical: false });
  }
  if (axisElementTypes.includes(childType)) {
    const axisProperties = chartChild.props as { tickMargin?: number; tickSize?: number };
    const horizontalTickMargin = chartTheme.textSize;
    const horizontalAxisHeight = Math.ceil(chartTheme.textSize * horizontalLabelLineHeight) + (axisProperties.tickMargin ?? horizontalTickMargin) + (axisProperties.tickSize ?? axisTickLength);
    const axisWidth = themingState.axisLabelWidth === undefined ? undefined : themingState.axisLabelWidth + (axisProperties.tickMargin ?? axisTickMargin) + (axisProperties.tickSize ?? axisTickLength);
    return applyDefaultProps(chartChild, {
      ...(childType === YAxis ? { width: axisWidth, tickMargin: axisTickMargin, tickSize: axisTickLength } : {}),
      ...(childType === XAxis ? { height: horizontalAxisHeight, tickMargin: horizontalTickMargin, tickSize: axisTickLength } : {}),
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
    return themeSeriesElement(chartChild, chartTheme, themingState);
  }
  return cloneElement(chartChild as ReactElement<{ children?: ReactNode }>, {}, themeChildList((chartChild.props as { children?: ReactNode }).children, chartTheme, themingState));
}

function themeSeriesElement(seriesElement: ReactElement, chartTheme: ChartThemeValues, themingState: ChartThemingState): ReactElement {
  const seriesColor = chartTheme.seriesPalette[themingState.nextSeriesIndex % chartTheme.seriesPalette.length]!;
  themingState.nextSeriesIndex += paletteIndexIncrement;
  const childType = seriesElement.type;
  let seriesDefaults: Record<string, unknown> = {};
  if (childType === Line) {
    seriesDefaults = { stroke: seriesColor, strokeWidth: seriesStrokeWidth, type: "monotone", dot: false, activeDot: { r: activeDotRadius, strokeWidth: activeDotStrokeWidth } };
  } else if (childType === Area) {
    seriesDefaults = { stroke: seriesColor, fill: seriesColor, fillOpacity: areaFillShare, strokeWidth: seriesStrokeWidth, type: "monotone" };
  } else if (childType === Bar) {
    seriesDefaults = { fill: seriesColor, radius: [barCornerRadius, barCornerRadius, squareCornerRadius, squareCornerRadius] };
  } else if (childType === Scatter) {
    seriesDefaults = { fill: seriesColor };
  } else if (childType === Radar) {
    seriesDefaults = { stroke: seriesColor, fill: seriesColor, fillOpacity: areaFillShare };
  } else if (childType === RadialBar) {
    seriesDefaults = { fill: seriesColor };
  }
  const themedElement = applyDefaultProps(seriesElement, { isAnimationActive: false, ...seriesDefaults });
  if (childType === Pie && (themedElement.props as { fill?: string }).fill === undefined) {
    return cloneElement(themedElement as ReactElement<{ children?: ReactNode }>, {}, themePieCells((themedElement.props as { children?: ReactNode }).children, chartTheme));
  }
  return themedElement;
}

function themePieCells(pieCells: ReactNode, chartTheme: ChartThemeValues): ReactNode {
  let pieCellIndex = firstPaletteIndex;
  return Children.map(pieCells, (pieCell) => {
    if (!isValidElement(pieCell) || pieCell.type !== Cell) {
      return pieCell;
    }
    const cellColor = chartTheme.seriesPalette[pieCellIndex % chartTheme.seriesPalette.length]!;
    pieCellIndex += paletteIndexIncrement;
    return applyDefaultProps(pieCell, { fill: cellColor });
  });
}

function buildTooltipDefaults(chartTheme: ChartThemeValues): Record<string, unknown> {
  return {
    contentStyle: {
      backgroundColor: chartTheme.tooltipBackgroundColor,
      border: "none",
      borderRadius: chartTheme.tooltipCornerRadius,
      boxShadow: `${tooltipShadowHorizontalOffset} ${tooltipShadowOffset}px ${tooltipShadowBlur}px rgb(0 0 0 / ${tooltipShadowOpacity})`,
      color: chartTheme.tooltipTextColor,
      fontFamily: chartTheme.textFontFamily,
      fontSize: chartTheme.textSize,
      padding: `${tooltipVerticalPadding}px ${tooltipHorizontalPadding}px`,
    },
    labelStyle: { color: chartTheme.tooltipMutedColor, marginBottom: tooltipLabelGap },
    itemStyle: { color: chartTheme.tooltipTextColor },
  };
}

function applyDefaultProps(chartElement: ReactElement, defaultProps: Record<string, unknown>): ReactElement {
  const elementProps = chartElement.props as Record<string, unknown>;
  const missingProps = Object.fromEntries(Object.entries(defaultProps).filter(([propName]) => elementProps[propName] === undefined));
  return Object.keys(missingProps).length > 0 ? cloneElement(chartElement as ReactElement<Record<string, unknown>>, missingProps) : chartElement;
}
