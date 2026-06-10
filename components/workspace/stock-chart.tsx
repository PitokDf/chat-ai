"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import type {
  CandlestickData,
  HistogramData,
  LineData,
  UTCTimestamp,
} from "lightweight-charts";
import { useChart, type IndicatorType, type TrendlineData, type HorizontalLineData } from "@/lib/store/chart";

interface StockChartProps {
  data: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  symbol: string;
  indicators?: IndicatorType[];
  trendlines?: TrendlineData[];
  horizontalLines?: HorizontalLineData[];
}

export function StockChart({
  data,
  symbol,
  indicators: propIndicators,
  trendlines: propTrendlines,
  horizontalLines: propHorizontalLines,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const allSeriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Area" | "Bar" | "Histogram">[]>([]);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const {
    chartType,
    indicators: storeIndicators,
    trendlines: storeTrendlines,
    horizontalLines: storeHorizontalLines,
    setCrosshairData,
    setSymbol,
  } = useChart();

  const indicators = propIndicators ?? storeIndicators;
  const trendlines = propTrendlines ?? storeTrendlines;
  const horizontalLines = propHorizontalLines ?? storeHorizontalLines;

  const calculateSMA = (prices: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        result.push(slice.reduce((a, b) => a + b, 0) / period);
      }
    }
    return result;
  };

  const calculateEMA = (prices: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    const k = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        result.push(ema);
      } else {
        ema = (prices[i] - ema) * k + ema;
        result.push(ema);
      }
    }
    return result;
  };

  const calculateBollingerBands = (
    prices: number[],
    period: number = 20,
    stdDev: number = 2,
  ) => {
    const upper: (number | null)[] = [];
    const middle: (number | null)[] = [];
    const lower: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        middle.push(null);
        lower.push(null);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance =
          slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const sd = Math.sqrt(variance);
        middle.push(sma);
        upper.push(sma + sd * stdDev);
        lower.push(sma - sd * stdDev);
      }
    }
    return { upper, middle, lower };
  };

  const calculateVWAP = (
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
  ): (number | null)[] => {
    const result: (number | null)[] = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += tp * volumes[i];
      cumulativeVolume += volumes[i];
      result.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null);
    }
    return result;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 400,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(75, 85, 99, 0.2)" },
        horzLines: { color: "rgba(75, 85, 99, 0.2)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: "rgba(255, 255, 255, 0.3)",
          style: LineStyle.Dashed,
        },
        horzLine: {
          width: 1,
          color: "rgba(255, 255, 255, 0.3)",
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(75, 85, 99, 0.3)",
      },
      timeScale: {
        borderColor: "rgba(75, 85, 99, 0.3)",
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        chart.applyOptions({ width, height: h });
      }
    });
    resizeObserver.observe(container);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }

      const candleData = param.seriesData.get(
        candleSeriesRef.current!,
      ) as CandlestickData | undefined;
      const volumeData = param.seriesData.get(
        volumeSeriesRef.current!,
      ) as HistogramData | undefined;

      if (candleData) {
        setCrosshairData({
          time: param.time,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData?.value ?? 0,
        });
      }
    });

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [setCrosshairData]);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    allSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {}
    });
    allSeriesRef.current = [];

    const candleData: CandlestickData[] = data.map((d) => ({
      time: (new Date(d.date).getTime() / 1000) as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData[] = data.map((d) => ({
      time: (new Date(d.date).getTime() / 1000) as UTCTimestamp,
      value: d.volume,
      color: d.close >= d.open ? "rgba(38, 166, 154, 0.5)" : "rgba(239, 83, 80, 0.5)",
    }));

    if (chartType === "candlestick") {
      const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderDownColor: "#ef5350",
        borderUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        wickUpColor: "#26a69a",
      });
      candleSeries.setData(candleData);
      candleSeriesRef.current = candleSeries;
      allSeriesRef.current.push(candleSeries);
    } else if (chartType === "line") {
      const lineSeries = chartRef.current.addSeries(LineSeries, {
        color: "#2196f3",
        lineWidth: 2,
      });
      lineSeries.setData(
        candleData.map((d) => ({ time: d.time, value: d.close })),
      );
      allSeriesRef.current.push(lineSeries);
    } else if (chartType === "area") {
      const areaSeries = chartRef.current.addSeries(AreaSeries, {
        lineColor: "#2196f3",
        topColor: "rgba(33, 150, 243, 0.4)",
        bottomColor: "rgba(33, 150, 243, 0.0)",
      });
      areaSeries.setData(
        candleData.map((d) => ({ time: d.time, value: d.close })),
      );
      allSeriesRef.current.push(areaSeries);
    } else if (chartType === "bar") {
      const barSeries = chartRef.current.addSeries(BarSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
      });
      barSeries.setData(candleData);
      allSeriesRef.current.push(barSeries);
    }

    if (indicators.includes("volume")) {
      const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
      allSeriesRef.current.push(volumeSeries);
    }

    const closes = data.map((d) => d.close);
    const times = candleData.map((d) => d.time);

    if (indicators.includes("sma20")) {
      const sma20 = calculateSMA(closes, 20);
      const sma20Series = chartRef.current.addSeries(LineSeries, {
        color: "#ff9800",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma20Series.setData(
        sma20
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(sma20Series);
    }

    if (indicators.includes("sma50")) {
      const sma50 = calculateSMA(closes, 50);
      const sma50Series = chartRef.current.addSeries(LineSeries, {
        color: "#e91e63",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma50Series.setData(
        sma50
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(sma50Series);
    }

    if (indicators.includes("sma200")) {
      const sma200 = calculateSMA(closes, 200);
      const sma200Series = chartRef.current.addSeries(LineSeries, {
        color: "#9c27b0",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma200Series.setData(
        sma200
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(sma200Series);
    }

    if (indicators.includes("ema12")) {
      const ema12 = calculateEMA(closes, 12);
      const ema12Series = chartRef.current.addSeries(LineSeries, {
        color: "#00bcd4",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema12Series.setData(
        ema12
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(ema12Series);
    }

    if (indicators.includes("ema26")) {
      const ema26 = calculateEMA(closes, 26);
      const ema26Series = chartRef.current.addSeries(LineSeries, {
        color: "#ff5722",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema26Series.setData(
        ema26
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(ema26Series);
    }

    if (indicators.includes("bollinger")) {
      const bb = calculateBollingerBands(closes);

      const bbUpperSeries = chartRef.current.addSeries(LineSeries, {
        color: "rgba(156, 39, 176, 0.5)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbUpperSeries.setData(
        bb.upper
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(bbUpperSeries);

      const bbMiddleSeries = chartRef.current.addSeries(LineSeries, {
        color: "rgba(156, 39, 176, 0.8)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbMiddleSeries.setData(
        bb.middle
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(bbMiddleSeries);

      const bbLowerSeries = chartRef.current.addSeries(LineSeries, {
        color: "rgba(156, 39, 176, 0.5)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbLowerSeries.setData(
        bb.lower
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(bbLowerSeries);
    }

    if (indicators.includes("vwap")) {
      const highs = data.map((d) => d.high);
      const lows = data.map((d) => d.low);
      const volumes = data.map((d) => d.volume);
      const vwap = calculateVWAP(highs, lows, closes, volumes);

      const vwapSeries = chartRef.current.addSeries(LineSeries, {
        color: "#4caf50",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      vwapSeries.setData(
        vwap
          .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
          .filter(Boolean) as LineData[],
      );
      allSeriesRef.current.push(vwapSeries);
    }

    trendlines.forEach((tl) => {
      const lineSeries = chartRef.current!.addSeries(LineSeries, {
        color: tl.color,
        lineWidth: tl.width as 1 | 2 | 3 | 4,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      lineSeries.setData([
        { time: tl.startTime, value: tl.startPrice },
        { time: tl.endTime, value: tl.endPrice },
      ]);
      allSeriesRef.current.push(lineSeries);
    });

    horizontalLines.forEach((hl) => {
      const lineSeries = chartRef.current!.addSeries(LineSeries, {
        color: hl.color,
        lineWidth: hl.width as 1 | 2 | 3 | 4,
        lineStyle: hl.style === "dashed" ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: true,
        title: hl.label,
      });
      const firstTime = times[0];
      const lastTime = times[times.length - 1];
      lineSeries.setData([
        { time: firstTime, value: hl.price },
        { time: lastTime, value: hl.price },
      ]);
      allSeriesRef.current.push(lineSeries);
    });

    chartRef.current.timeScale().fitContent();
  }, [
    data,
    chartType,
    indicators,
    trendlines,
    horizontalLines,
  ]);

  useEffect(() => {
    setSymbol(symbol);
  }, [symbol, setSymbol]);

  return (
    <div className="relative h-full w-full">
      <div ref={chartContainerRef} className="h-full w-full" />
    </div>
  );
}
