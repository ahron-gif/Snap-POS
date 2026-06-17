import React, { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import type { ChatVisualizationDto } from "../../types/chatbot";

type ApexChartType =
  | "line"
  | "area"
  | "bar"
  | "pie"
  | "donut"
  | "radialBar"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "candlestick"
  | "boxPlot"
  | "radar"
  | "polarArea"
  | "rangeBar"
  | "rangeArea"
  | "treemap";

interface Props {
  viz: ChatVisualizationDto;
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const ChatChart: React.FC<Props> = ({ viz }) => {
  const isDark = useIsDarkMode();

  const { options, series, height, chartType } = useMemo(() => {
    const theme = isDark
      ? {
          mode: "dark" as const,
          background: "transparent",
          textColor: "#d1d5db",
          gridColor: "#374151",
          tooltipTheme: "dark" as const,
        }
      : {
          mode: "light" as const,
          background: "transparent",
          textColor: "#374151",
          gridColor: "#e5e7eb",
          tooltipTheme: "light" as const,
        };

    const isPieLike = viz.type === "pie" || viz.type === "donut";

    if (isPieLike) {
      const first = viz.series[0];
      const data = first ? first.data : [];
      const pieOptions: ApexOptions = {
        chart: {
          type: viz.type === "donut" ? "donut" : "pie",
          toolbar: { show: false },
          fontFamily: "inherit",
          background: theme.background,
          foreColor: theme.textColor,
        },
        theme: { mode: theme.mode },
        labels: viz.categories,
        title: viz.title
          ? {
              text: viz.title,
              style: { fontSize: "12px", fontWeight: 600, color: theme.textColor },
            }
          : undefined,
        legend: {
          position: "bottom",
          fontSize: "11px",
          labels: { colors: theme.textColor },
        },
        dataLabels: { style: { fontSize: "10px" } },
        tooltip: { theme: theme.tooltipTheme },
      };
      return {
        options: pieOptions,
        series: data,
        height: 240,
        chartType: viz.type === "donut" ? "donut" : "pie",
      };
    }

    const cartesianOptions: ApexOptions = {
      chart: {
        type: viz.type,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: theme.background,
        foreColor: theme.textColor,
      },
      theme: { mode: theme.mode },
      plotOptions: {
        bar: {
          horizontal: !!viz.horizontal,
          borderRadius: 3,
          columnWidth: "55%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: viz.categories,
        title: viz.xAxisLabel
          ? { text: viz.xAxisLabel, style: { color: theme.textColor } }
          : undefined,
        labels: { style: { fontSize: "10px", colors: theme.textColor } },
        axisBorder: { color: theme.gridColor },
        axisTicks: { color: theme.gridColor },
      },
      yaxis: {
        title: viz.yAxisLabel
          ? { text: viz.yAxisLabel, style: { color: theme.textColor } }
          : undefined,
        labels: { style: { fontSize: "10px", colors: theme.textColor } },
      },
      title: viz.title
        ? {
            text: viz.title,
            style: { fontSize: "12px", fontWeight: 600, color: theme.textColor },
          }
        : undefined,
      grid: { strokeDashArray: 3, borderColor: theme.gridColor },
      stroke: {
        width: viz.type === "line" || viz.type === "area" ? 2 : 0,
        curve: "smooth",
      },
      legend: {
        fontSize: "11px",
        labels: { colors: theme.textColor },
      },
      tooltip: { theme: theme.tooltipTheme },
    };

    const mappedSeries = viz.series.map((s) => ({ name: s.name, data: s.data }));
    const dynamicHeight =
      viz.horizontal && viz.categories.length > 0
        ? Math.min(360, Math.max(180, viz.categories.length * 26 + 60))
        : 240;

    return {
      options: cartesianOptions,
      series: mappedSeries,
      height: dynamicHeight,
      chartType: viz.type,
    };
  }, [viz, isDark]);

  const hasData =
    viz.categories.length > 0 &&
    viz.series.some((s) => s.data && s.data.length > 0);

  if (!hasData) return null;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2">
      <Chart
        options={options}
        series={series as ApexOptions["series"]}
        type={chartType as ApexChartType}
        height={height}
      />
    </div>
  );
};

export default ChatChart;
