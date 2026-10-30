import type { ToolMeasurements } from "./benchmark-measurements.ts";

type MeasuredField = "loadMilliseconds" | "heapMegabytes" | "javascriptKilobytes" | "developmentSeconds" | "buildSeconds" | "installMegabytes";
type ChartMetric = { measuredField: MeasuredField; metricTitle: string; formatValue: (measuredValue: number) => string };

const ourToolName = "slidemachina";
const chartWidth = 880;
const chartPadding = 32;
const headerHeight = 96;
const footerHeight = 56;
const columnCount = 2;
const columnGap = 24;
const cardHeight = 178;
const cardGap = 20;
const cardPadding = 20;
const cardTitleHeight = 34;
const barRowHeight = 30;
const toolLabelWidth = 104;
const valueLabelWidth = 84;
const barHeight = 16;
const smallestBarWidth = 3;
// Within this share of the best value we count as tied: runner noise is larger than that.
const tieShare = 0.05;
const winningColor = "#16a34a";
const losingColor = "#dc2626";
const tiedColor = "#ca8a04";
const rivalColor = "#cbd5e1";
const textColor = "#0f172a";
const mutedColor = "#64748b";
const cardColor = "#f8fafc";
const borderColor = "#e2e8f0";
const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const titleFontSize = 22;
const cardTitleFontSize = 15;
const labelFontSize = 13;
const noteFontSize = 12;
const titleBaseline = 44;
const legendTop = 68;
const legendSwatchSize = 12;
const legendTextGap = 18;
const legendItemWidth = 190;
const footerBaselineGap = 24;
const chartCornerRadius = 16;
const cardCornerRadius = 12;
const barCornerRadius = 4;
const swatchCornerRadius = 3;
const labelBaselineShift = 3;
const cardTitleBaseline = 14;
const boldWeight = 700;
const heavyWeight = 800;
const regularWeight = 400;

const chartMetrics: ChartMetric[] = [
  { measuredField: "loadMilliseconds", metricTitle: "First slide on screen", formatValue: (measuredValue) => `${Math.round(measuredValue)} ms` },
  { measuredField: "javascriptKilobytes", metricTitle: "JavaScript sent, gzip", formatValue: (measuredValue) => `${Math.round(measuredValue)} KB` },
  { measuredField: "heapMegabytes", metricTitle: "Memory after load", formatValue: (measuredValue) => `${measuredValue.toFixed(1)} MB` },
  { measuredField: "developmentSeconds", metricTitle: "Dev server to first slide", formatValue: (measuredValue) => `${measuredValue.toFixed(2)} s` },
  { measuredField: "buildSeconds", metricTitle: "Production build", formatValue: (measuredValue) => `${measuredValue.toFixed(2)} s` },
  { measuredField: "installMegabytes", metricTitle: "node_modules", formatValue: (measuredValue) => `${Math.round(measuredValue)} MB` },
];

function escapeSvgText(plainText: string): string {
  return plainText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pickOurColor(ourValue: number, rivalValues: number[]): string {
  const bestRival = Math.min(...rivalValues);
  if (ourValue <= bestRival * (1 - tieShare)) return winningColor;
  if (ourValue <= bestRival * (1 + tieShare)) return tiedColor;
  return losingColor;
}

function drawMetricCard(chartMetric: ChartMetric, toolMeasurements: ToolMeasurements[], cardLeft: number, cardTop: number, cardWidth: number): string {
  const measuredValues = toolMeasurements.map((measuredTool) => measuredTool[chartMetric.measuredField]);
  const largestValue = Math.max(...measuredValues);
  const ourValue = toolMeasurements.find((measuredTool) => measuredTool.toolName === ourToolName)![chartMetric.measuredField];
  const ourColor = pickOurColor(ourValue, toolMeasurements.filter((measuredTool) => measuredTool.toolName !== ourToolName).map((measuredTool) => measuredTool[chartMetric.measuredField]));
  const barSpace = cardWidth - cardPadding * 2 - toolLabelWidth - valueLabelWidth;
  const barRows = toolMeasurements.map((measuredTool, toolIndex) => {
    const isOurs = measuredTool.toolName === ourToolName;
    const measuredValue = measuredTool[chartMetric.measuredField];
    const rowTop = cardTop + cardPadding + cardTitleHeight + toolIndex * barRowHeight;
    const barWidth = Math.max(smallestBarWidth, (measuredValue / largestValue) * barSpace);
    const textWeight = isOurs ? boldWeight : regularWeight;
    return [
      `<text x="${cardLeft + cardPadding}" y="${rowTop + barHeight - labelBaselineShift}" font-size="${labelFontSize}" font-weight="${textWeight}" fill="${textColor}">${escapeSvgText(measuredTool.toolName)}</text>`,
      `<rect x="${cardLeft + cardPadding + toolLabelWidth}" y="${rowTop}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="${barCornerRadius}" fill="${isOurs ? ourColor : rivalColor}"/>`,
      `<text x="${cardLeft + cardWidth - cardPadding}" y="${rowTop + barHeight - labelBaselineShift}" font-size="${labelFontSize}" font-weight="${textWeight}" text-anchor="end" fill="${isOurs ? ourColor : mutedColor}">${chartMetric.formatValue(measuredValue)}</text>`,
    ].join("");
  });
  return [
    `<rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="${cardCornerRadius}" fill="${cardColor}" stroke="${borderColor}"/>`,
    `<text x="${cardLeft + cardPadding}" y="${cardTop + cardPadding + cardTitleBaseline}" font-size="${cardTitleFontSize}" font-weight="${boldWeight}" fill="${textColor}">${chartMetric.metricTitle}</text>`,
    `<text x="${cardLeft + cardWidth - cardPadding}" y="${cardTop + cardPadding + cardTitleBaseline}" font-size="${noteFontSize}" text-anchor="end" fill="${mutedColor}">lower is better</text>`,
    ...barRows,
  ].join("\n");
}

// One picture for the README on GitHub and on npm: a light card that reads on a dark page too.
export function drawBenchmarkChart(toolMeasurements: ToolMeasurements[], measuredDate: string, repeatCount: number, slideCount: number, machineLabel: string): string {
  const rowCount = Math.ceil(chartMetrics.length / columnCount);
  const chartHeight = headerHeight + rowCount * (cardHeight + cardGap) - cardGap + footerHeight;
  const cardWidth = (chartWidth - chartPadding * 2 - columnGap) / columnCount;
  const metricCards = chartMetrics.map((chartMetric, metricIndex) => {
    const cardLeft = chartPadding + (metricIndex % columnCount) * (cardWidth + columnGap);
    const cardTop = headerHeight + Math.floor(metricIndex / columnCount) * (cardHeight + cardGap);
    return drawMetricCard(chartMetric, toolMeasurements, cardLeft, cardTop, cardWidth);
  });
  const versionLine = toolMeasurements.map((measuredTool) => `${measuredTool.toolName} ${measuredTool.toolVersion}`).join(" · ");
  const legendItems = [
    [winningColor, "slidemachina is the best"],
    [tiedColor, "on par"],
    [losingColor, "slidemachina is behind"],
  ];
  const legendMarkup = legendItems
    .map(([legendColor, legendText], legendIndex) => {
      const legendLeft = chartPadding + legendIndex * legendItemWidth;
      return `<rect x="${legendLeft}" y="${legendTop}" width="${legendSwatchSize}" height="${legendSwatchSize}" rx="${swatchCornerRadius}" fill="${legendColor}"/><text x="${legendLeft + legendTextGap}" y="${legendTop + legendSwatchSize - 1}" font-size="${noteFontSize}" fill="${mutedColor}">${legendText}</text>`;
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" font-family="${fontStack}">`,
    `<rect width="${chartWidth}" height="${chartHeight}" rx="${chartCornerRadius}" fill="#ffffff" stroke="${borderColor}"/>`,
    `<text x="${chartPadding}" y="${titleBaseline}" font-size="${titleFontSize}" font-weight="${heavyWeight}" fill="${textColor}">The same talk of ${slideCount} slides in four tools</text>`,
    `<text x="${chartWidth - chartPadding}" y="${titleBaseline}" font-size="${labelFontSize}" text-anchor="end" fill="${mutedColor}">${measuredDate}, median of ${repeatCount} runs</text>`,
    legendMarkup,
    ...metricCards,
    `<text x="${chartPadding}" y="${chartHeight - footerBaselineGap}" font-size="${noteFontSize}" fill="${mutedColor}">${escapeSvgText(versionLine)} · latest versions from npm · ${escapeSvgText(machineLabel)}</text>`,
    "</svg>",
    "",
  ].join("\n");
}

export function writeResultsTable(toolMeasurements: ToolMeasurements[]): string {
  const headerRow = `| | ${toolMeasurements.map((measuredTool) => `${measuredTool.toolName} ${measuredTool.toolVersion}`).join(" | ")} |`;
  const dividerRow = `|---|${toolMeasurements.map(() => "---").join("|")}|`;
  const metricRows = chartMetrics.map((chartMetric) => `| ${chartMetric.metricTitle} | ${toolMeasurements.map((measuredTool) => chartMetric.formatValue(measuredTool[chartMetric.measuredField])).join(" | ")} |`);
  return [headerRow, dividerRow, ...metricRows].join("\n");
}
