import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { readChartTheme, compareChartThemes, type ChartThemeValues } from "./chart-theme.ts";
import { themeChartChildren } from "./chart-children.ts";

export type ChartProperties = {
  children: ReactElement;
  height?: CSSProperties["height"];
  stretch?: boolean;
  className?: string;
};

export function RenderChartBlock({ children: chartChildren, height: chartHeight, stretch: stretchesChart = false, className }: ChartProperties): ReactElement {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const [chartTheme, setChartTheme] = useState<ChartThemeValues | null>(null);
  // Stable slide children can skip rerenders; observe the tone on the slide itself.
  useLayoutEffect(() => {
    const containerElement = containerReference.current;
    if (containerElement === null) return;
    const slideElement = containerElement.closest("[data-slide]");
    const refreshChartTheme = () => {
      const nextTheme = readChartTheme(containerElement);
      setChartTheme((currentTheme) => (compareChartThemes(currentTheme, nextTheme) ? currentTheme : nextTheme));
    };
    refreshChartTheme();
    if (slideElement === null) return;
    const toneObserver = new MutationObserver(refreshChartTheme);
    toneObserver.observe(slideElement, { attributes: true, attributeFilter: ["data-tone"] });
    return () => toneObserver.disconnect();
  }, []);
  const containerClassName = ["machina-chart", stretchesChart ? "machina-chart-stretch" : undefined, className].filter(Boolean).join(" ");
  return (
    <div ref={containerReference} className={containerClassName} style={chartHeight === undefined ? undefined : { height: chartHeight }}>
      {chartTheme === null ? null : <ResponsiveContainer>{themeChartChildren(chartChildren, chartTheme)}</ResponsiveContainer>}
    </div>
  );
}
