import { ColorType, createChart, type DeepPartial, type IChartApi, type TimeChartOptions } from "lightweight-charts";

/** Colors the canvas needs from the stylesheet; the chart library cannot read `var()` itself. */
export interface ChartTheme {
  color: (name: string) => string;
  border: string;
  fontFamily: string;
}

export function readChartTheme(): ChartTheme {
  const root = getComputedStyle(document.documentElement);
  const color = (name: string) => root.getPropertyValue(name).trim();
  return { color, border: color("--border"), fontFamily: root.fontFamily };
}

/** A chart in the terminal's palette; panels add their series and any time-axis formatting. */
export function createTerminalChart(
  container: HTMLElement,
  theme: ChartTheme,
  options: DeepPartial<TimeChartOptions> = {},
): IChartApi {
  return createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: theme.color("--panel") },
      textColor: theme.color("--muted"),
      fontFamily: theme.fontFamily,
      attributionLogo: false,
    },
    grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
    rightPriceScale: { borderColor: theme.border },
    crosshair: {
      horzLine: { labelBackgroundColor: theme.color("--amber") },
      vertLine: { labelBackgroundColor: theme.color("--amber") },
    },
    ...options,
    timeScale: { borderColor: theme.border, ...options.timeScale },
  });
}
