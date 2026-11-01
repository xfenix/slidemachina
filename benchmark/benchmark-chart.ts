import type { ToolMeasurements } from "./benchmark-measurements.ts";

type MeasuredField = "loadMilliseconds" | "slideChangeMilliseconds" | "developmentSeconds" | "buildSeconds" | "outputMegabytes" | "pdfExportSeconds";
type ChartMetric = { measuredField: MeasuredField; metricTitle: string; formatValue: (measuredValue: number) => string };

const ourToolName = "slidemachina";
const chartWidth = 880;
const chartPadding = 0;
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
  { measuredField: "slideChangeMilliseconds", metricTitle: "Key press to screen update", formatValue: (measuredValue) => `${Math.round(measuredValue)} ms` },
  { measuredField: "developmentSeconds", metricTitle: "Dev server to first slide", formatValue: (measuredValue) => `${measuredValue.toFixed(2)} s` },
  { measuredField: "buildSeconds", metricTitle: "Production build", formatValue: (measuredValue) => `${measuredValue.toFixed(2)} s` },
  { measuredField: "outputMegabytes", metricTitle: "Build output size", formatValue: (measuredValue) => `${measuredValue.toFixed(1)} MB` },
  { measuredField: "pdfExportSeconds", metricTitle: "PDF export", formatValue: (measuredValue) => `${measuredValue.toFixed(1)} s` },
];

function escapeSvgText(plainText: string): string {
  return plainText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pickOurColor(ourValue: number, rivalValues: (number | null)[]): string {
  const measuredRivals = rivalValues.filter((rivalValue) => rivalValue !== null);
  if (measuredRivals.length === 0) return winningColor;
  const bestRival = Math.min(...measuredRivals);
  if (ourValue <= bestRival * (1 - tieShare)) return winningColor;
  if (ourValue <= bestRival * (1 + tieShare)) return tiedColor;
  return losingColor;
}

function drawMetricCard(chartMetric: ChartMetric, toolMeasurements: ToolMeasurements[], cardLeft: number, cardTop: number, cardWidth: number): string {
  const ourValue = toolMeasurements.find((measuredTool) => measuredTool.toolName === ourToolName)![chartMetric.measuredField] as number;
  const measuredValues = toolMeasurements.flatMap((measuredTool) => {
    const measuredValue = measuredTool[chartMetric.measuredField];
    return measuredValue === null ? [] : [measuredValue];
  });
  const largestValue = Math.max(...measuredValues);
  const ourColor = pickOurColor(ourValue, toolMeasurements.filter((measuredTool) => measuredTool.toolName !== ourToolName).map((measuredTool) => measuredTool[chartMetric.measuredField]));
  const barSpace = cardWidth - cardPadding * 2 - toolLabelWidth - valueLabelWidth;
  const barRows = toolMeasurements.map((measuredTool, toolIndex) => {
    const isOurs = measuredTool.toolName === ourToolName;
    const measuredValue = measuredTool[chartMetric.measuredField];
    const rowTop = cardTop + cardPadding + cardTitleHeight + toolIndex * barRowHeight;
    const barRow = [
      `<text x="${cardLeft + cardPadding}" y="${rowTop + barHeight - labelBaselineShift}" font-size="${labelFontSize}" font-weight="${isOurs ? boldWeight : regularWeight}" fill="var(--sm-text)">${escapeSvgText(measuredTool.toolName)}</text>`,
    ];
    if (measuredValue === null) {
      barRow.push(`<text x="${cardLeft + cardPadding + toolLabelWidth}" y="${rowTop + barHeight - labelBaselineShift}" font-size="${labelFontSize}" fill="var(--sm-muted)">no built-in command</text>`);
      return barRow.join("");
    }
    const barWidth = Math.max(smallestBarWidth, (measuredValue / largestValue) * barSpace);
    barRow.push(
      `<rect x="${cardLeft + cardPadding + toolLabelWidth}" y="${rowTop}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="${barCornerRadius}" fill="${isOurs ? ourColor : "var(--sm-rival)"}"/>`,
      `<text x="${cardLeft + cardWidth - cardPadding}" y="${rowTop + barHeight - labelBaselineShift}" font-size="${labelFontSize}" font-weight="${isOurs ? boldWeight : regularWeight}" text-anchor="end" fill="${isOurs ? ourColor : "var(--sm-muted)"}">${chartMetric.formatValue(measuredValue)}</text>`,
    );
    return barRow.join("");
  });
  return [
    `<rect x="${cardLeft}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="${cardCornerRadius}" fill="var(--sm-card)" stroke="var(--sm-border)"/>`,
    `<text x="${cardLeft + cardPadding}" y="${cardTop + cardPadding + cardTitleBaseline}" font-size="${cardTitleFontSize}" font-weight="${boldWeight}" fill="var(--sm-text)">${chartMetric.metricTitle}</text>`,
    `<text x="${cardLeft + cardWidth - cardPadding}" y="${cardTop + cardPadding + cardTitleBaseline}" font-size="${noteFontSize}" text-anchor="end" fill="var(--sm-muted)">lower is better</text>`,
    ...barRows,
  ].join("\n");
}

// One picture for the README on GitHub and on npm: no outer padding, the page background shows around the content.
// Neutral colors are CSS variables with a dark palette under prefers-color-scheme, so one file serves both GitHub themes.
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
      return `<rect x="${legendLeft}" y="${legendTop}" width="${legendSwatchSize}" height="${legendSwatchSize}" rx="${swatchCornerRadius}" fill="${legendColor}"/><text x="${legendLeft + legendTextGap}" y="${legendTop + legendSwatchSize - 1}" font-size="${noteFontSize}" fill="var(--sm-muted)">${legendText}</text>`;
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" font-family="${fontStack}">`,
    "<style>",
    ":root { --sm-text: #0f172a; --sm-muted: #64748b; --sm-card: #f8fafc; --sm-border: #e2e8f0; --sm-rival: #cbd5e1; }",
    "@media (prefers-color-scheme: dark) { :root { --sm-text: #e2e8f0; --sm-muted: #94a3b8; --sm-card: #161b22; --sm-border: #30363d; --sm-rival: #475569; } }",
    "</style>",
    `<text x="${chartPadding}" y="${titleBaseline}" font-size="${titleFontSize}" font-weight="${heavyWeight}" fill="var(--sm-text)">The same talk of ${slideCount} slides in four tools</text>`,
    `<text x="${chartWidth - chartPadding}" y="${titleBaseline}" font-size="${labelFontSize}" text-anchor="end" fill="var(--sm-muted)">${measuredDate}, median of ${repeatCount} runs</text>`,
    legendMarkup,
    ...metricCards,
    `<text x="${chartPadding}" y="${chartHeight - footerBaselineGap}" font-size="${noteFontSize}" fill="var(--sm-muted)">${escapeSvgText(versionLine)} · latest versions from npm · ${escapeSvgText(machineLabel)}</text>`,
    "</svg>",
    "",
  ].join("\n");
}

export function writeResultsTable(toolMeasurements: ToolMeasurements[]): string {
  const headerRow = `| | ${toolMeasurements.map((measuredTool) => `${measuredTool.toolName} ${measuredTool.toolVersion}`).join(" | ")} |`;
  const dividerRow = `|---|${toolMeasurements.map(() => "---").join("|")}|`;
  const metricRows = chartMetrics.map((chartMetric) => `| ${chartMetric.metricTitle} | ${toolMeasurements.map((measuredTool) => { const measuredValue = measuredTool[chartMetric.measuredField]; return measuredValue === null ? "—" : chartMetric.formatValue(measuredValue); }).join(" | ")} |`);
  return [headerRow, dividerRow, ...metricRows].join("\n");
}
