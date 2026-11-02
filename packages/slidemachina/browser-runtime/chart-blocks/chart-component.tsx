import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";
import { readChartTheme, compareChartThemes, themeChartChildren, type ChartThemeValues } from "./chart-theme.ts";

export type ChartProperties = {
  // One recharts chart element: LineChart, BarChart, AreaChart, PieChart, ComposedChart, ScatterChart, RadarChart or RadialBarChart.
  children: ReactElement;
  // The block height; unset, the chart is --chart-height tall.
  height?: CSSProperties["height"];
  // The chart grows into the free space under the blocks above, like stretch on Image.
  stretch?: boolean;
  className?: string;
};

export function Chart({ children, height, stretch = false, className }: ChartProperties): ReactElement {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const [chartTheme, setChartTheme] = useState<ChartThemeValues | null>(null);
  // The theme is read from computed styles, so a chart recolours with the slide tone. A slide re-render does not reach
  // this component: its element in the presentation tree is the same object, so the tone is watched on the slide itself.
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
  const containerClassName = ["machina-chart", stretch ? "machina-chart-stretch" : undefined, className].filter(Boolean).join(" ");
  return (
    <div ref={containerReference} className={containerClassName} style={height === undefined ? undefined : { height }}>
      {chartTheme === null ? null : <ResponsiveContainer>{themeChartChildren(children, chartTheme)}</ResponsiveContainer>}
    </div>
  );
}
