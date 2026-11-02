import { useLayoutEffect, useState, type RefObject } from "react";

const minimumAxisLabelWidth = 0;

export function useChartAxisWidth(containerReference: RefObject<HTMLDivElement | null>): number | undefined {
  const [axisLabelWidth, setAxisLabelWidth] = useState<number>();
  useLayoutEffect(() => {
    const chartContainer = containerReference.current;
    if (chartContainer === null) return;
    const measureAxisLabels = () => {
      const axisLabelElements = [...chartContainer.querySelectorAll<SVGTextElement>(".recharts-yAxis-tick-labels text")];
      if (!axisLabelElements.length) return;
      // SVG boxes stay in slide coordinates when the presentation canvas is scaled.
      const measuredLabelWidth = Math.ceil(Math.max(...axisLabelElements.map((labelElement) => labelElement.getBBox().width)));
      if (measuredLabelWidth <= minimumAxisLabelWidth) return;
      setAxisLabelWidth((currentLabelWidth) => currentLabelWidth === measuredLabelWidth ? currentLabelWidth : measuredLabelWidth);
    };
    const axisMutationObserver = new MutationObserver(measureAxisLabels);
    const axisResizeObserver = new ResizeObserver(measureAxisLabels);
    axisMutationObserver.observe(chartContainer, { childList: true, characterData: true, subtree: true });
    axisResizeObserver.observe(chartContainer);
    document.fonts.addEventListener("loadingdone", measureAxisLabels);
    measureAxisLabels();
    return () => {
      axisMutationObserver.disconnect();
      axisResizeObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", measureAxisLabels);
    };
  }, [containerReference]);
  return axisLabelWidth;
}
