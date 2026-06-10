"use client";

import { create } from "zustand";
import type { CandlestickData, HistogramData, LineData, Time } from "lightweight-charts";

export type ChartTimeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD";

export type ChartType = "candlestick" | "line" | "area" | "bar";

export type IndicatorType =
  | "sma20"
  | "sma50"
  | "sma200"
  | "ema12"
  | "ema26"
  | "bollinger"
  | "vwap"
  | "volume";

export type DrawingType = "trendline" | "horizontal" | "fibonacci";

export interface TrendlineData {
  id: string;
  startTime: Time;
  startPrice: number;
  endTime: Time;
  endPrice: number;
  color: string;
  width: number;
}

export interface HorizontalLineData {
  id: string;
  price: number;
  color: string;
  label: string;
  width: number;
  style: "solid" | "dashed";
}

export interface ChartState {
  symbol: string;
  timeframe: ChartTimeframe;
  chartType: ChartType;
  indicators: IndicatorType[];
  trendlines: TrendlineData[];
  horizontalLines: HorizontalLineData[];
  crosshairData: {
    time: Time | null;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null;
  isLoading: boolean;
  error: string | null;

  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: ChartTimeframe) => void;
  setChartType: (type: ChartType) => void;
  toggleIndicator: (indicator: IndicatorType) => void;
  addTrendline: (trendline: TrendlineData) => void;
  removeTrendline: (id: string) => void;
  addHorizontalLine: (line: HorizontalLineData) => void;
  removeHorizontalLine: (id: string) => void;
  setCrosshairData: (data: ChartState["crosshairData"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearDrawings: () => void;
  reset: () => void;
}

export const useChart = create<ChartState>((set) => ({
  symbol: "",
  timeframe: "1M",
  chartType: "candlestick",
  indicators: ["volume", "sma20", "sma50"],
  trendlines: [],
  horizontalLines: [],
  crosshairData: null,
  isLoading: false,
  error: null,

  setSymbol: (symbol) => set({ symbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setChartType: (chartType) => set({ chartType }),
  toggleIndicator: (indicator) =>
    set((state) => ({
      indicators: state.indicators.includes(indicator)
        ? state.indicators.filter((i) => i !== indicator)
        : [...state.indicators, indicator],
    })),
  addTrendline: (trendline) =>
    set((state) => ({ trendlines: [...state.trendlines, trendline] })),
  removeTrendline: (id) =>
    set((state) => ({
      trendlines: state.trendlines.filter((t) => t.id !== id),
    })),
  addHorizontalLine: (line) =>
    set((state) => ({ horizontalLines: [...state.horizontalLines, line] })),
  removeHorizontalLine: (id) =>
    set((state) => ({
      horizontalLines: state.horizontalLines.filter((l) => l.id !== id),
    })),
  setCrosshairData: (crosshairData) => set({ crosshairData }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearDrawings: () => set({ trendlines: [], horizontalLines: [] }),
  reset: () =>
    set({
      symbol: "",
      timeframe: "1M",
      chartType: "candlestick",
      indicators: ["volume", "sma20", "sma50"],
      trendlines: [],
      horizontalLines: [],
      crosshairData: null,
      isLoading: false,
      error: null,
    }),
}));
